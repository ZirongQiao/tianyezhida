const TAP_FEEDBACK_MS = 180;

Page({
  data: {
    activeBtn: "",
  },

  onShow() {
    this.setData({ activeBtn: "" });
  },

  runWithFeedback(key, action) {
    if (this.data.activeBtn) {
      return;
    }

    this.setData({ activeBtn: key });

    setTimeout(() => {
      action();

      if (key !== "register" && key !== "claim") {
        this.setData({ activeBtn: "" });
      }
    }, TAP_FEEDBACK_MS);
  },

  onClaimTap() {
    this.runWithFeedback("claim", () => {
      wx.navigateTo({
        url: "/pages/farmer/claim/claim",
      });
    });
  },

  onRegisterTap() {
    this.runWithFeedback("register", () => {
      this.onWechatLogin();
    });
  },

  onWechatLogin() {
    wx.navigateTo({
      url: "/pages/register/step2/step2",
    });
  },

  onGoBuyer() {
    wx.reLaunch({
      url: "/pages/map/map",
    });
  },

  onOpenLegal(e) {
    const type = e.currentTarget.dataset.type;
    if (type !== "user" && type !== "privacy") {
      return;
    }
    wx.navigateTo({
      url: `/pages/legal/legal?type=${type}`,
    });
  },
});
