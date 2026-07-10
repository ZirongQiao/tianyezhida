// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // 请替换为自己的微信云开发环境 ID
      env: "cloud1-your-env-id",
      userInfo: null,
      userRole: "buyer",
      isRegistered: false,
      currentMerchantId: null,
      registerDraft: null,
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // 请替换为自己的微信云开发环境 ID
        env: "cloud1-your-env-id",
        traceUser: true,
      });
    }
  },
});
