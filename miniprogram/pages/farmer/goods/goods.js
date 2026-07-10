const {
  getCurrentRegisteredMerchant,
  updateRegisteredMerchant,
} = require("../../../utils/merchant-store");
const { updateMerchantCategories } = require("../../../utils/merchant-api");

const CATEGORY_NAMES = [
  "鸡蛋",
  "鸭蛋",
  "鹅蛋",
  "时令蔬菜",
  "时令水果",
  "蜂蜜",
];

function buildCategoryRows(savedCategories) {
  const enabledSet = new Set(savedCategories || []);
  return CATEGORY_NAMES.map((name) => ({
    name,
    enabled: enabledSet.has(name),
  }));
}

Page({
  data: {
    statusBarHeight: 0,
    categories: buildCategoryRows([]),
    currentMerchantId: null,
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
  },

  onShow() {
    this.loadCategoriesFromMerchant();
  },

  loadCategoriesFromMerchant() {
    const merchant = getCurrentRegisteredMerchant();
    const saved =
      merchant && Array.isArray(merchant.categories) ? merchant.categories : [];
    this.setData({
      categories: buildCategoryRows(saved),
      currentMerchantId: merchant ? merchant.id : null,
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onCategorySwitch(e) {
    const index = e.currentTarget.dataset.index;
    const key = `categories[${index}].enabled`;
    this.setData({
      [key]: e.detail.value,
    });
  },

  async onSave() {
    const selectedCategories = this.data.categories
      .filter((item) => item.enabled)
      .map((item) => item.name);

    const merchant = getCurrentRegisteredMerchant();
    const cloudId = merchant && merchant._id ? String(merchant._id).trim() : "";
    if (!cloudId) {
      wx.showToast({ title: "保存失败，请重试", icon: "none" });
      return;
    }

    wx.showLoading({ title: "保存中", mask: true });

    try {
      const result = await updateMerchantCategories(cloudId, selectedCategories);
      if (!result.success) {
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
        return;
      }

      const updated = updateRegisteredMerchant(
        { categories: selectedCategories },
        this.data.currentMerchantId
      );

      if (!updated) {
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
        return;
      }

      const empty = selectedCategories.length === 0;
      if (empty) {
        wx.showModal({
          title: "提示",
          content: "当前没有可售货品，地图将不会显示您的农户信息。",
          showCancel: false,
          confirmText: "我知道了",
          success: (res) => {
            if (res.confirm) {
              wx.navigateBack();
            }
          },
        });
      } else {
        wx.showToast({ title: "保存成功", icon: "success" });
        setTimeout(() => {
          wx.navigateBack();
        }, 800);
      }
    } catch (e) {
      console.warn("[goods] onSave failed", e);
      wx.showToast({ title: "保存失败，请重试", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
});
