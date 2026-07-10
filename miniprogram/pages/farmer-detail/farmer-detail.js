const { handleNavigateToFarmer } = require("../../utils/navigate");
const { getMerchantTheme } = require("../../utils/merchant");
const {
  getMerchantById,
  getWantBuyState,
  toggleWantBuy,
} = require("../../utils/merchant-api");
const {
  getMerchantContacts,
  dialMerchantContacts,
} = require("../../utils/contacts");
const { buildDetailAddressLines } = require("../../utils/address");
const {
  resolveMerchantAvatarUrl,
  getMerchantAvatarInitial,
} = require("../../utils/avatar");

function normalizeMerchantDetail(raw, wantBuyState) {
  const photos = raw.photos || [];
  const categoryWantBuy =
    (wantBuyState && wantBuyState.categoryWantBuy) ||
    raw.categoryWantBuy ||
    {};
  const myCategories = new Set(
    (wantBuyState && wantBuyState.myCategories) || []
  );
  const categoryList = (raw.categories || []).map((name) => ({
    name,
    wantBuyCount: categoryWantBuy[name] || 0,
    reserved: myCategories.has(name),
  }));

  const theme = getMerchantTheme(raw);
  const { regionLine, detailLine } = buildDetailAddressLines(raw);

  return {
    id: raw.id,
    _id: raw._id || "",
    name: raw.name,
    lat: raw.lat,
    lng: raw.lng,
    merchantType: theme.type,
    typeLabel: theme.label,
    tagBg: theme.tagBg,
    tagColor: theme.tagColor,
    bubbleColor: theme.bubbleColor,
    regionLine,
    detailLine,
    avatarUrl: resolveMerchantAvatarUrl(raw),
    avatarInitial: getMerchantAvatarInitial(raw),
    contacts: getMerchantContacts(raw),
    categoryList,
    photos,
    hasPhotos: photos.length > 0,
  };
}

Page({
  data: {
    statusBarHeight: 0,
    farmer: null,
    albumCurrent: 1,
    albumTotal: 0,
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 0,
    });
    this.loadFarmerDetail(options.id);
  },

  async loadFarmerDetail(id) {
    const raw = await getMerchantById(id);

    if (!raw) {
      wx.showToast({
        title: "商户不存在",
        icon: "none",
      });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const merchantCloudId = raw._id ? String(raw._id) : "";
    const wantBuyState = merchantCloudId
      ? await getWantBuyState(merchantCloudId)
      : { categoryWantBuy: {}, myCategories: [] };
    const farmer = normalizeMerchantDetail(raw, wantBuyState);

    this.setData({
      farmer,
      albumTotal: farmer.hasPhotos ? farmer.photos.length : 0,
      albumCurrent: 1,
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onShare() {
    wx.showToast({
      title: "分享功能开发中",
      icon: "none",
    });
  },

  onAlbumChange(e) {
    this.setData({
      albumCurrent: e.detail.current + 1,
    });
  },

  onAvatarTap() {
    const avatarUrl = this.data.farmer && this.data.farmer.avatarUrl;
    if (!avatarUrl) {
      return;
    }
    wx.previewImage({
      current: avatarUrl,
      urls: [avatarUrl],
    });
  },

  onPhotoTap(e) {
    const index = e.currentTarget.dataset.index;
    const photos = (this.data.farmer && this.data.farmer.photos) || [];
    if (!photos.length) {
      return;
    }
    const current = photos[index] || photos[0];
    wx.previewImage({
      current,
      urls: photos,
    });
  },

  onCallPhone() {
    dialMerchantContacts(this.data.farmer.contacts);
  },

  async onWantBuyTap(e) {
    const index = e.currentTarget.dataset.index;
    if (index === undefined || index === null) return;

    const farmer = this.data.farmer;
    if (!farmer) return;

    const categoryItem = farmer.categoryList[index];
    if (!categoryItem) return;

    const merchantCloudId = farmer._id ? String(farmer._id) : "";
    if (!merchantCloudId) {
      wx.showToast({ title: "无法提交，请稍后重试", icon: "none" });
      return;
    }

    const result = await toggleWantBuy(merchantCloudId, categoryItem.name);
    if (!result.success) {
      wx.showToast({ title: "操作失败，请重试", icon: "none" });
      return;
    }

    this.setData({
      [`farmer.categoryList[${index}].reserved`]: result.reserved,
      [`farmer.categoryList[${index}].wantBuyCount`]: result.wantBuyCount,
    });

    if (result.reserved) {
      wx.showToast({
        title: "农户无法保留库存，出发前建议电话确认，避免售罄！",
        icon: "none",
        duration: 2500,
      });
    } else {
      wx.showToast({
        title: "已取消预约",
        icon: "none",
      });
    }
  },

  onNavigate() {
    handleNavigateToFarmer(this.data.farmer);
  },

  onShareAppMessage() {
    const farmer = this.data.farmer;
    if (!farmer) {
      return {
        title: "田间直达",
        path: "/pages/map/map",
      };
    }
    const categories = (farmer.categoryList || []).map((c) => c.name);
    return {
      title: `${farmer.name} · ${categories.join("、")}`,
      path: `/pages/farmer-detail/farmer-detail?id=${farmer.id}`,
    };
  },
});
