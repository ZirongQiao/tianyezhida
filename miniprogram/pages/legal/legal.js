const USER_AGREEMENT = require("../../legal/user-agreement");
const PRIVACY_POLICY = require("../../legal/privacy-policy");

Page({
  data: {
    content: "",
  },

  onLoad(options) {
    const type = String((options && options.type) || "").trim();
    let title = "协议";
    let content = "";

    if (type === "user") {
      title = "用户协议";
      content = USER_AGREEMENT;
    } else if (type === "privacy") {
      title = "隐私政策";
      content = PRIVACY_POLICY;
    } else {
      content = "未找到对应协议内容。";
    }

    wx.setNavigationBarTitle({ title });
    this.setData({ content });
  },
});
