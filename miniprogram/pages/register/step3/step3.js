const { FORM_ERRORS } = require("../../../utils/merchant");
const { prepareMerchantAddressFields } = require("../../../utils/address");
const { submitMerchantDraft } = require("../../../utils/merchant-api");
const { getAllMerchants } = require("../../../utils/merchant-store");
const { hasValidContacts } = require("../../../utils/contacts");
const { uploadMerchantRegistrationMedia } = require("../../../utils/upload-media");

const CATEGORY_NAMES = [
  "鸡蛋",
  "鸭蛋",
  "鹅蛋",
  "时令蔬菜",
  "时令水果",
  "蜂蜜",
];

const PHOTO_SLOT_COUNT = 3;
const CHOOSE_MEDIA_OPTIONS = {
  mediaType: ["image"],
  sourceType: ["album", "camera"],
};

function fillEmptyPhotoSlots(photos, paths) {
  const next = photos.slice();
  let pathIndex = 0;
  for (let i = 0; i < next.length && pathIndex < paths.length; i++) {
    if (!next[i]) {
      next[i] = paths[pathIndex++];
    }
  }
  return next;
}

Page({
  data: {
    statusBarHeight: 0,
    photos: ["", "", ""],
    avatar: "",
    categories: CATEGORY_NAMES.map((name) => ({
      name,
      enabled: false,
    })),
    submitting: false,
    agreementPrivacyChecked: false,
    infoTruthChecked: false,
    displayConsentChecked: false,
    navigationAwareChecked: false,
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 0,
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onChoosePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.photos.slice();

    if (photos[index]) {
      wx.chooseMedia({
        ...CHOOSE_MEDIA_OPTIONS,
        count: 1,
        success: (res) => {
          photos[index] = res.tempFiles[0].tempFilePath;
          this.setData({ photos });
        },
      });
      return;
    }

    const filledCount = photos.filter(Boolean).length;
    const remaining = PHOTO_SLOT_COUNT - filledCount;

    if (remaining <= 0) {
      wx.showToast({ title: "最多上传3张照片", icon: "none" });
      return;
    }

    const openChooser = () => {
      wx.chooseMedia({
        ...CHOOSE_MEDIA_OPTIONS,
        count: remaining,
        success: (res) => {
          const paths = res.tempFiles.map((file) => file.tempFilePath);
          this.setData({
            photos: fillEmptyPhotoSlots(photos, paths),
          });
        },
      });
    };

    if (remaining === 2) {
      wx.showToast({ title: "还可以上传2张照片", icon: "none" });
      setTimeout(openChooser, 400);
      return;
    }

    if (remaining === 1) {
      wx.showToast({ title: "还可以上传1张照片", icon: "none" });
      setTimeout(openChooser, 400);
      return;
    }

    openChooser();
  },

  onChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        this.setData({
          avatar: res.tempFiles[0].tempFilePath,
        });
      },
    });
  },

  onCategorySwitch(e) {
    const index = e.currentTarget.dataset.index;
    const key = `categories[${index}].enabled`;
    this.setData({
      [key]: e.detail.value,
    });
  },

  onAgreementPrivacyChange(e) {
    this.setData({
      agreementPrivacyChecked: (e.detail.value || []).length > 0,
    });
  },

  onInfoTruthChange(e) {
    this.setData({
      infoTruthChecked: (e.detail.value || []).length > 0,
    });
  },

  onDisplayConsentChange(e) {
    this.setData({
      displayConsentChecked: (e.detail.value || []).length > 0,
    });
  },

  onNavigationAwareChange(e) {
    this.setData({
      navigationAwareChecked: (e.detail.value || []).length > 0,
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

  hasAllAgreementChecks() {
    const {
      agreementPrivacyChecked,
      infoTruthChecked,
      displayConsentChecked,
      navigationAwareChecked,
    } = this.data;
    return (
      agreementPrivacyChecked &&
      infoTruthChecked &&
      displayConsentChecked &&
      navigationAwareChecked
    );
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const app = getApp();
    const draft = app.globalData && app.globalData.registerDraft;
    if (!draft) {
      wx.showToast({ title: "请先填写基本信息", icon: "none" });
      return;
    }

    if (!hasValidContacts(draft.contacts)) {
      wx.showToast({
        title: "请至少填写一个有效联系电话",
        icon: "none",
      });
      return;
    }

    const filledPhotos = this.data.photos.filter(Boolean);
    if (filledPhotos.length < 3) {
      wx.showToast({ title: "请至少上传3张照片", icon: "none" });
      return;
    }

    const selectedCategories = this.data.categories
      .filter((item) => item.enabled)
      .map((item) => item.name);
    if (!selectedCategories.length) {
      wx.showToast({ title: "请至少选择一个品类", icon: "none" });
      return;
    }

    if (!this.hasAllAgreementChecks()) {
      wx.showToast({
        title: "请先阅读并同意相关协议及授权确认",
        icon: "none",
      });
      return;
    }

    const maxId = getAllMerchants().reduce(
      (max, item) => Math.max(max, item.id || 0),
      0
    );

    const addressFields = prepareMerchantAddressFields(
      draft.merchantType,
      draft.addressRaw || ""
    );

    const merchantCloudId = draft._id ? String(draft._id).trim() : "";
    if (!merchantCloudId) {
      wx.showToast({ title: "创建失败，请重试", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: "上传中", mask: true });

    let photoFileIds;
    let avatarFileId;
    try {
      const uploaded = await uploadMerchantRegistrationMedia({
        photos: filledPhotos,
        avatar: this.data.avatar,
        merchantCloudId,
      });
      photoFileIds = uploaded.photoFileIds;
      avatarFileId = uploaded.avatarFileId;
    } catch (e) {
      console.warn("[step3] upload media failed", e);
      wx.showToast({ title: "图片上传失败，请重试", icon: "none" });
      wx.hideLoading();
      this.setData({ submitting: false });
      return;
    }

    const merchant = {
      id: maxId + 1,
      merchantType: draft.merchantType,
      name: draft.fullMerchantName,
      fullMerchantName: draft.fullMerchantName,
      merchantName: draft.merchantName,
      contacts: draft.contacts,
      province: draft.province,
      city: draft.city,
      county: draft.county,
      town: draft.town || "",
      ...addressFields,
      regionText: draft.regionText,
      lat: draft.confirmedLat != null ? draft.confirmedLat : null,
      lng: draft.confirmedLng != null ? draft.confirmedLng : null,
      categories: selectedCategories,
      photos: photoFileIds,
      avatarUrl: avatarFileId,
      status: "pending",
      agreementAccepted: true,
      privacyAccepted: true,
      authorizationAccepted: true,
    };

    wx.showLoading({ title: "提交中", mask: true });

    try {
      const submitResult = await submitMerchantDraft(merchantCloudId, merchant);
      if (submitResult.duplicate) {
        wx.showToast({
          title: FORM_ERRORS.ADDRESS_DUPLICATE,
          icon: "none",
          duration: 2500,
        });
        return;
      }
      if (!submitResult.success) {
        wx.showToast({ title: "提交失败，请重试", icon: "none" });
        return;
      }

      if (app.globalData) {
        app.globalData.userRole = "farmer";
        app.globalData.isRegistered = true;
        app.globalData.currentMerchantId = merchant.id;
        app.globalData.registerDraft = null;
      }

      wx.showToast({
        title: "提交成功，等待审核",
        icon: "success",
        duration: 1500,
      });

      setTimeout(() => {
        wx.reLaunch({
          url: "/pages/farmer/home/home",
        });
      }, 1500);
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },
});
