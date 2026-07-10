const { submitClaimRequest } = require("../../../utils/merchant-api");
const { validateSingleMobileRow } = require("../../../utils/contacts");

Page({
  data: {
    phone: "",
    phoneError: "",
    phoneInvalid: false,
    submitting: false,
    submitted: false,
  },

  onPhoneInput(e) {
    if (this.data.submitted) {
      return;
    }

    const phone = String(e.detail.value || "").trim();
    this.setData({
      phone,
      phoneError: "",
      phoneInvalid: false,
    });
  },

  validatePhone() {
    const phone = String(this.data.phone || "").trim();

    if (!phone) {
      this.setData({
        phoneError: "请输入手机号",
        phoneInvalid: true,
      });
      wx.showToast({ title: "请输入手机号", icon: "none" });
      return null;
    }

    const rowCheck = validateSingleMobileRow(phone);
    if (rowCheck.invalid) {
      this.setData({
        phoneError: "请输入正确的手机号",
        phoneInvalid: true,
      });
      wx.showToast({ title: "请输入正确的手机号", icon: "none" });
      return null;
    }

    this.setData({
      phoneError: "",
      phoneInvalid: false,
    });
    return phone;
  },

  async onSubmit() {
    if (this.data.submitting || this.data.submitted) {
      return;
    }

    const phone = this.validatePhone();
    if (!phone) {
      return;
    }

    this.setData({ submitting: true });

    try {
      const result = await submitClaimRequest(phone);

      if (result.success) {
        this.setData({ submitted: true });
        wx.showToast({
          title: result.message || "申请已提交，请等待平台审核",
          icon: "none",
        });
        return;
      }

      wx.showToast({
        title: result.message || "提交失败，请重试",
        icon: "none",
      });
    } catch (e) {
      console.warn("[claim] onSubmit failed", e);
      wx.showToast({ title: "网络异常，请重试", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onGoBuyer() {
    wx.reLaunch({
      url: "/pages/map/map",
    });
  },
});
