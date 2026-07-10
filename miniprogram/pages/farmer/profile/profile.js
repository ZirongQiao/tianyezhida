const {
  getCurrentRegisteredMerchant,
  updateRegisteredMerchant,
} = require("../../../utils/merchant-store");
const {
  resolveMerchantAvatarUrl,
  getMerchantAvatarInitial,
} = require("../../../utils/avatar");
const { updateMerchantProfile } = require("../../../utils/merchant-api");
const { uploadMerchantProfileMedia } = require("../../../utils/upload-media");
const { buildMobileContact, CONTACT_ERRORS } = require("../../../utils/contacts");
const { MERCHANT_TYPE, resolveMerchantType } = require("../../../utils/merchant");

function buildProfileNameFields(merchant, displayName) {
  const fullMerchantName = String(displayName || "").trim();
  const fields = {
    fullMerchantName,
    name: fullMerchantName,
  };

  if (merchant && merchant.merchantName != null) {
    const merchantType =
      merchant.merchantType || resolveMerchantType(merchant || {});
    if (merchantType === MERCHANT_TYPE.FARMER && fullMerchantName.endsWith("家")) {
      fields.merchantName = fullMerchantName.slice(0, -1);
    } else {
      fields.merchantName = fullMerchantName;
    }
  }

  return fields;
}

function buildProfileContacts(existingContacts, phoneInput) {
  const raw = String(phoneInput || "").trim();
  const others = (existingContacts || []).filter((c) => c.type !== "mobile");

  if (!raw) {
    return others;
  }

  const mobile = buildMobileContact(raw);
  if (!mobile) {
    return null;
  }

  return [mobile, ...others];
}

function loadProfileFromMerchant() {
  const m = getCurrentRegisteredMerchant();
  const name = m ? m.fullMerchantName || m.name || "" : "我的商户";
  let phone = "";
  if (m && m.contacts && m.contacts.length) {
    const mobile = m.contacts.find((c) => c.type === "mobile");
    phone = mobile ? mobile.raw || mobile.normalized || "" : "";
  }
  const region = m && m.province ? [m.province, m.city, m.county].filter(Boolean) : [];
  const regionText = region.join(" ");
  const address = m ? m.addressDisplay || m.addressRaw || "" : "";
  const photos = m && m.photos && m.photos.length >= 3 ? m.photos.slice(0, 3) : ["", "", ""];
  return {
    merchantName: name,
    merchantType: m ? m.merchantType || "" : "",
    avatarInitial: getMerchantAvatarInitial(m || { name }),
    avatarUrl: m ? resolveMerchantAvatarUrl(m) : "",
    phone,
    region,
    regionText,
    address,
    photos: photos.length === 3 ? photos : ["", "", ""],
    currentMerchantId: m ? m.id : null,
  };
}

Page({
  data: {
    statusBarHeight: 0,
    merchantName: "",
    avatarInitial: "农",
    avatarUrl: "",
    phone: "",
    region: [],
    regionText: "",
    address: "",
    photos: ["", "", ""],
    merchantType: "",
    currentMerchantId: null,
  },

  refreshProfileFromMerchant() {
    this.setData(loadProfileFromMerchant());
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
    this.refreshProfileFromMerchant();
  },

  onShow() {
    if (this._pickingMedia) {
      this._pickingMedia = false;
      return;
    }
    this.refreshProfileFromMerchant();
  },

  onBack() {
    wx.navigateBack();
  },

  onChangeAvatar() {
    this._pickingMedia = true;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath;
        this.setData({ avatarUrl: path });
      },
    });
  },

  onNameInput(e) {
    this.setData({ merchantName: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onChoosePhoto(e) {
    const index = e.currentTarget.dataset.index;
    this._pickingMedia = true;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath;
        const photos = this.data.photos.slice();
        photos[index] = path;
        this.setData({ photos });
      },
    });
  },

  async onSave() {
    const merchant = getCurrentRegisteredMerchant();
    const cloudId = merchant && merchant._id ? String(merchant._id).trim() : "";
    if (!cloudId) {
      wx.showToast({ title: "无法保存，请重新登录", icon: "none" });
      return;
    }

    wx.showLoading({ title: "保存中", mask: true });

    try {
      const fullMerchantName = String(this.data.merchantName || "").trim();
      if (!fullMerchantName) {
        wx.showToast({ title: "请输入商户名称", icon: "none" });
        return;
      }

      const nameFields = buildProfileNameFields(merchant, fullMerchantName);
      const contacts = buildProfileContacts(merchant.contacts, this.data.phone);
      if (contacts === null) {
        wx.showToast({ title: CONTACT_ERRORS.MOBILE, icon: "none" });
        return;
      }

      const { avatarUrl, photos } = await uploadMerchantProfileMedia({
        merchantId: cloudId,
        avatarUrl: this.data.avatarUrl,
        photos: this.data.photos,
      });

      const payload = {
        avatarUrl,
        photos,
        fullMerchantName: nameFields.fullMerchantName,
        name: nameFields.name,
        contacts,
      };
      if (nameFields.merchantName != null) {
        payload.merchantName = nameFields.merchantName;
      }

      const result = await updateMerchantProfile(cloudId, payload);
      if (!result.success) {
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
        return;
      }

      updateRegisteredMerchant(
        {
          avatarUrl,
          photos,
          fullMerchantName: nameFields.fullMerchantName,
          name: nameFields.name,
          contacts,
          ...(nameFields.merchantName != null
            ? { merchantName: nameFields.merchantName }
            : {}),
        },
        this.data.currentMerchantId
      );

      wx.showToast({ title: "保存成功", icon: "success" });
    } catch (e) {
      console.warn("[profile] onSave failed", e);
      wx.showToast({ title: "保存失败，请重试", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
});
