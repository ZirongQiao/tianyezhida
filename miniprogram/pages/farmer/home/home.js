const {
  getCurrentRegisteredMerchant,
  updateRegisteredMerchant,
} = require("../../../utils/merchant-store");
const {
  getMerchantById,
  resolveCurrentFarmerCloudId,
  getWantBuyLatestCreatedAt,
  getFarmerMessageLastReadAt,
  updateMerchantCategories,
} = require("../../../utils/merchant-api");
const {
  resolveMerchantAvatarUrl,
  getMerchantAvatarInitial,
} = require("../../../utils/avatar");

function formatMerchantStatus(status) {
  if (status === "approved") return "已上线";
  return "审核中";
}

function loadFarmerInfo() {
  const m = getCurrentRegisteredMerchant();
  if (m) {
    const name = m.fullMerchantName || m.name || "我的商户";
    const categories = Array.isArray(m.categories) ? m.categories : [];
    return {
      name,
      initial: getMerchantAvatarInitial(m),
      avatarUrl: resolveMerchantAvatarUrl(m),
      status: formatMerchantStatus(m.status),
      currentMerchantId: m.id,
      categories,
      isOnSale: categories.length > 0,
    };
  }
  return {
    name: "我的商户",
    initial: "农",
    avatarUrl: "",
    status: "审核中",
    currentMerchantId: null,
    categories: [],
    isOnSale: false,
  };
}

Page({
  data: {
    statusBarHeight: 0,
    merchantName: "我的商户",
    avatarInitial: "农",
    avatarUrl: "",
    status: "审核中",
    currentMerchantId: null,
    categories: [],
    isOnSale: false,
    hasMessageUnread: false,
  },

  refreshFarmerInfo() {
    const info = loadFarmerInfo();
    this.setData({
      merchantName: info.name,
      avatarInitial: info.initial,
      avatarUrl: info.avatarUrl,
      status: info.status,
      currentMerchantId: info.currentMerchantId,
      categories: info.categories,
      isOnSale: info.isOnSale,
    });
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const app = getApp();
    if (app.globalData) {
      app.globalData.userRole = "farmer";
    }

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 0,
    });
    this.refreshFarmerInfo();
  },

  onShow() {
    this.refreshFarmerInfo();
    this.syncMerchantStatusFromCloud();
    this.checkMessageUnread();
  },

  async syncMerchantStatusFromCloud() {
    const m = getCurrentRegisteredMerchant();
    if (!m || !m._id) {
      return;
    }

    try {
      const cloud = await getMerchantById(String(m._id));
      if (!cloud || !cloud.status || cloud.status === m.status) {
        return;
      }
      updateRegisteredMerchant({ status: cloud.status }, m.id);
      this.refreshFarmerInfo();
    } catch (e) {
      console.warn("[farmer/home] syncMerchantStatus failed", e);
    }
  },

  async checkMessageUnread() {
    const merchantCloudId = await resolveCurrentFarmerCloudId();
    if (!merchantCloudId) {
      this.setData({ hasMessageUnread: false });
      return;
    }

    const lastReadAt = getFarmerMessageLastReadAt(merchantCloudId);
    const latestCreatedAtMs = await getWantBuyLatestCreatedAt(merchantCloudId);
    this.setData({
      hasMessageUnread: latestCreatedAtMs > lastReadAt,
    });
  },

  onExit() {
    const app = getApp();
    if (app.globalData) {
      app.globalData.isRegistered = false;
    }
    wx.reLaunch({ url: "/pages/map/map" });
  },

  onGoGoods() {
    wx.navigateTo({ url: "/pages/farmer/goods/goods" });
  },

  onCustomSaleToggleTap() {
    this.onSaleSwitchChange({ detail: { value: !this.data.isOnSale } });
  },

  async onSaleSwitchChange(e) {
    const wantOnSale = e.detail.value;
    const { isOnSale } = this.data;

    if (wantOnSale && !isOnSale) {
      wx.navigateTo({ url: "/pages/farmer/goods/goods" });
      return;
    }

    if (!wantOnSale && isOnSale) {
      const m = getCurrentRegisteredMerchant();
      const cloudId = m && m._id ? String(m._id).trim() : "";
      if (!cloudId) {
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
        return;
      }

      wx.showLoading({ title: "保存中", mask: true });

      try {
        const result = await updateMerchantCategories(cloudId, []);
        if (!result.success) {
          wx.showToast({ title: "保存失败，请重试", icon: "none" });
          return;
        }

        updateRegisteredMerchant({ categories: [] }, m.id);
        this.refreshFarmerInfo();

        wx.showModal({
          title: "提示",
          content: "您已暂停售卖。\n\n买家将无法在地图中看到您的农户信息。",
          showCancel: false,
          confirmText: "我知道了",
        });
      } catch (err) {
        console.warn("[farmer/home] onSaleSwitchChange failed", err);
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
      } finally {
        wx.hideLoading();
      }
    }
  },

  onGoProfile() {
    wx.navigateTo({ url: "/pages/farmer/profile/profile" });
  },

  onGoMessages() {
    wx.navigateTo({ url: "/pages/farmer/messages/messages" });
  },

  onGoBuyer() {
    const app = getApp();
    if (app.globalData) {
      app.globalData.userRole = "buyer";
    }
    wx.reLaunch({ url: "/pages/map/map" });
  },
});
