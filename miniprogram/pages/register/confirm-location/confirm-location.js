const { geocodeAddress } = require("../../../utils/merchant-api");

const DEFAULT_LAT = 30.67;
const DEFAULT_LNG = 104.08;
const DEFAULT_SCALE = 16;

Page({
  data: {
    statusBarHeight: 0,
    latitude: DEFAULT_LAT,
    longitude: DEFAULT_LNG,
    scale: DEFAULT_SCALE,
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 0,
    });

    const app = getApp();
    const draft = app.globalData && app.globalData.registerDraft;
    if (!draft || !draft.addressNormalized) {
      wx.showToast({ title: "请先填写基本信息", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.initMapCenter(draft);
  },

  onReady() {
    this.mapCtx = wx.createMapContext("confirmMap", this);
  },

  getUserLocationOnce() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: "gcj02",
        success: (res) => {
          resolve({
            lat: res.latitude,
            lng: res.longitude,
          });
        },
        fail: () => resolve(null),
      });
    });
  },

  async initMapCenter(draft) {
    const userLocation = await this.getUserLocationOnce();
    const geoCoords = await geocodeAddress(draft.addressNormalized);

    if (geoCoords) {
      this.setData({
        latitude: geoCoords.lat,
        longitude: geoCoords.lng,
      });
      return;
    }

    if (userLocation) {
      this.setData({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      });
      return;
    }

    this.setData({
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onConfirm() {
    const app = getApp();
    if (!app.globalData || !app.globalData.registerDraft) {
      wx.showToast({ title: "请先填写基本信息", icon: "none" });
      return;
    }

    const mapCtx = this.mapCtx || wx.createMapContext("confirmMap", this);
    mapCtx.getCenterLocation({
      success: (res) => {
        app.globalData.registerDraft.confirmedLat = res.latitude;
        app.globalData.registerDraft.confirmedLng = res.longitude;
        wx.navigateTo({ url: "/pages/register/step3/step3" });
      },
      fail: () => {
        wx.showToast({ title: "获取位置失败，请重试", icon: "none" });
      },
    });
  },
});
