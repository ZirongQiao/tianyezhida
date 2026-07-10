const { buildFullMerchantName, FORM_ERRORS } = require("../../../utils/merchant");
const {
  validateAddress,
  prepareMerchantAddressFields,
} = require("../../../utils/address");
const { checkAddressDuplicate, createMerchantDraft } = require("../../../utils/merchant-api");
const {
  createEmptyMobileRow,
  createEmptyLandlineRow,
  validateRegisterContacts,
  validateSingleMobileRow,
  validateSingleLandlineRow,
  sanitizeMobileInput,
  CONFIRM_SKIP_INVALID_MSG,
} = require("../../../utils/contacts");

const NAME_PLACEHOLDER = {
  farmer: "如：王大爷、李婆婆、张大妈",
  business: "如：青城山土鸡农场、王记生态农庄",
};

const ADDRESS_PLACEHOLDER = {
  farmer: "请输入详细地址（精确到门牌号）",
  business: "请输入完整经营地址（精确到门牌号）",
};

let contactRowSeed = 1;

Page({
  data: {
    statusBarHeight: 0,
    merchantType: "farmer",
    namePlaceholder: NAME_PLACEHOLDER.farmer,
    addressPlaceholder: ADDRESS_PLACEHOLDER.farmer,
    merchantName: "",
    merchantNameError: "",
    merchantNameInvalid: false,
    mobiles: [createEmptyMobileRow(contactRowSeed++)],
    landlines: [createEmptyLandlineRow(contactRowSeed++)],
    contactsFormError: "",
    region: [],
    regionText: "",
    regionError: "",
    regionInvalid: false,
    address: "",
    addressError: "",
    addressInvalid: false,
    submitting: false,
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

  onTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      merchantType: type,
      namePlaceholder: NAME_PLACEHOLDER[type],
      addressPlaceholder: ADDRESS_PLACEHOLDER[type],
      merchantNameError: "",
      merchantNameInvalid: false,
    });
  },

  onNameInput(e) {
    const merchantName = e.detail.value;
    this.setData({
      merchantName,
      merchantNameError: "",
      merchantNameInvalid: false,
    });
  },

  onNameBlur() {
    const { merchantName } = this.data;
    if (!merchantName || !merchantName.trim()) {
      return;
    }
    if (buildFullMerchantName(this.data.merchantType, merchantName)) {
      this.setData({
        merchantNameError: "",
        merchantNameInvalid: false,
      });
    }
  },

  onAddMobile() {
    this.setData({
      mobiles: [...this.data.mobiles, createEmptyMobileRow(contactRowSeed++)],
      contactsFormError: "",
    });
  },

  onAddLandline() {
    this.setData({
      landlines: [...this.data.landlines, createEmptyLandlineRow(contactRowSeed++)],
      contactsFormError: "",
    });
  },

  onDeleteMobile(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.mobiles.length <= 1) {
      return;
    }
    this.setData({
      mobiles: this.data.mobiles.filter((row) => row.id !== id),
      contactsFormError: "",
    });
  },

  onDeleteLandline(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.landlines.length <= 1) {
      return;
    }
    this.setData({
      landlines: this.data.landlines.filter((row) => row.id !== id),
      contactsFormError: "",
    });
  },

  onMobileInput(e) {
    const id = e.currentTarget.dataset.id;
    const value = sanitizeMobileInput(e.detail.value);
    const mobiles = this.data.mobiles.map((row) => {
      if (row.id !== id) return row;
      return {
        ...row,
        value,
        error: "",
        invalid: false,
      };
    });
    this.setData({ mobiles, contactsFormError: "" });
  },

  onMobileBlur(e) {
    const id = e.currentTarget.dataset.id;
    const mobiles = this.data.mobiles.map((row) => {
      if (row.id !== id) return row;
      const result = validateSingleMobileRow(row.value);
      return { ...row, ...result };
    });
    this.setData({ mobiles });
  },

  onLandlineAreaInput(e) {
    const id = e.currentTarget.dataset.id;
    const area = e.detail.value;
    const landlines = this.data.landlines.map((row) => {
      if (row.id !== id) return row;
      return {
        ...row,
        area,
        areaError: "",
        numberError: "",
        areaInvalid: false,
        numberInvalid: false,
      };
    });
    this.setData({ landlines, contactsFormError: "" });
  },

  onLandlineNumberInput(e) {
    const id = e.currentTarget.dataset.id;
    const number = e.detail.value;
    const landlines = this.data.landlines.map((row) => {
      if (row.id !== id) return row;
      return {
        ...row,
        number,
        areaError: "",
        numberError: "",
        areaInvalid: false,
        numberInvalid: false,
      };
    });
    this.setData({ landlines, contactsFormError: "" });
  },

  onLandlineBlur(e) {
    const id = e.currentTarget.dataset.id;
    const landlines = this.data.landlines.map((row) => {
      if (row.id !== id) return row;
      const result = validateSingleLandlineRow(row.area, row.number);
      return { ...row, ...result };
    });
    this.setData({ landlines });
  },

  onRegionChange(e) {
    const region = e.detail.value;
    this.setData({
      region,
      regionText: region.join(" "),
      regionError: "",
      regionInvalid: false,
    });
  },

  onAddressInput(e) {
    this.setData({
      address: e.detail.value,
      addressError: "",
      addressInvalid: false,
    });
  },

  onAddressBlur() {
    const { address } = this.data;
    if (address && address.trim()) {
      this.setData({
        addressError: "",
        addressInvalid: false,
      });
    }
  },

  validateStep2Form(mobiles, landlines) {
    const { merchantType, merchantName, region, address } = this.data;

    let merchantNameError = "";
    let merchantNameInvalid = false;
    let regionError = "";
    let regionInvalid = false;
    let addressError = "";
    let addressInvalid = false;

    const fullMerchantName = buildFullMerchantName(merchantType, merchantName);
    if (!fullMerchantName) {
      merchantNameError = FORM_ERRORS.MERCHANT_NAME_EMPTY;
      merchantNameInvalid = true;
    }

    const contactResult = validateRegisterContacts(mobiles, landlines);

    if (!region || region.length < 3) {
      regionError = FORM_ERRORS.REGION_EMPTY;
      regionInvalid = true;
    }

    const addressCheck = validateAddress(address);
    if (!addressCheck.ok) {
      addressError = addressCheck.message;
      addressInvalid = true;
    }

    const syncValid =
      !merchantNameInvalid &&
      contactResult.canProceed &&
      !regionInvalid &&
      !addressInvalid;

    const firstToast =
      merchantNameError ||
      (contactResult.allRejected ? contactResult.contactsFormError : "") ||
      regionError ||
      addressError ||
      "";

    return {
      syncValid,
      firstToast,
      fullMerchantName,
      contactResult,
      merchantNameError,
      merchantNameInvalid,
      regionError,
      regionInvalid,
      addressError,
      addressInvalid,
      mobiles: contactResult.mobiles,
      landlines: contactResult.landlines,
      contactsFormError: contactResult.contactsFormError,
    };
  },

  applyFormValidation(formResult) {
    this.setData({
      merchantNameError: formResult.merchantNameError,
      merchantNameInvalid: formResult.merchantNameInvalid,
      mobiles: formResult.mobiles,
      landlines: formResult.landlines,
      contactsFormError: formResult.contactsFormError,
      regionError: formResult.regionError,
      regionInvalid: formResult.regionInvalid,
      addressError: formResult.addressError,
      addressInvalid: formResult.addressInvalid,
    });
  },

  async proceedWithContacts(contacts) {
    const { merchantType, merchantName, region, regionText, address } =
      this.data;

    const fullMerchantName = buildFullMerchantName(merchantType, merchantName);
    const addressFields = prepareMerchantAddressFields(
      merchantType,
      address.trim()
    );

    this.setData({ submitting: true });
    wx.showLoading({ title: "校验地址中", mask: true });

    try {
      const dupResult = await checkAddressDuplicate({
        addressNormalized: addressFields.addressNormalized,
        province: region[0],
        city: region[1],
        county: region[2],
      });

      if (dupResult.duplicate) {
        this.setData({
          addressError: FORM_ERRORS.ADDRESS_DUPLICATE,
          addressInvalid: true,
        });
        wx.showToast({
          title: FORM_ERRORS.ADDRESS_DUPLICATE,
          icon: "none",
          duration: 2500,
        });
        return;
      }

      const draftData = {
        merchantType,
        merchantName: merchantName.trim(),
        fullMerchantName,
        contacts,
        region,
        regionText,
        province: region[0],
        city: region[1],
        county: region[2],
        town: "",
        ...addressFields,
      };

      const draftResult = await createMerchantDraft(draftData);
      if (!draftResult.success || !draftResult._id) {
        wx.showToast({
          title: "创建失败，请重试",
          icon: "none",
        });
        return;
      }

      const app = getApp();
      if (app.globalData) {
        app.globalData.registerDraft = {
          ...draftData,
          _id: draftResult._id,
          status: "draft",
        };
      }

      wx.navigateTo({
        url: "/pages/register/confirm-location/confirm-location",
      });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  async onNext() {
    if (this.data.submitting) return;

    const { mobiles, landlines } = this.data;
    const formResult = this.validateStep2Form(mobiles, landlines);
    this.applyFormValidation(formResult);

    if (!formResult.syncValid) {
      if (formResult.firstToast) {
        wx.showToast({
          title: formResult.firstToast,
          icon: "none",
        });
      }
      return;
    }

    const validContacts = formResult.contactResult.contacts;

    if (formResult.contactResult.needConfirm) {
      wx.showModal({
        title: "提示",
        content: CONFIRM_SKIP_INVALID_MSG,
        confirmText: "继续",
        cancelText: "返回修改",
        success: (res) => {
          if (res.confirm) {
            this.proceedWithContacts(validContacts);
          }
        },
      });
      return;
    }

    await this.proceedWithContacts(validContacts);
  },
});
