const { MOCK_MERCHANTS } = require("../data/merchants");

/** 地图/详情已接云库时设为 false；调试可改回 true 恢复 mock */
const USE_MOCK = false;

const STORAGE_KEY = "registered_merchants_v2";

function getRegisteredMerchants() {
  try {
    return wx.getStorageSync(STORAGE_KEY) || [];
  } catch (e) {
    return [];
  }
}

function saveRegisteredMerchant(merchant) {
  const list = getRegisteredMerchants();
  list.push(merchant);
  wx.setStorageSync(STORAGE_KEY, list);
}

function getAllMerchants() {
  const local = getRegisteredMerchants();
  if (USE_MOCK) {
    return [...MOCK_MERCHANTS, ...local];
  }
  return local;
}

/** 当前登录农户（已注册）：优先 globalData.currentMerchantId，否则取本地最后一条 */
function getCurrentRegisteredMerchant() {
  const list = getRegisteredMerchants();
  if (!list.length) {
    return null;
  }

  try {
    const app = getApp();
    const id = app.globalData && app.globalData.currentMerchantId;
    if (id != null) {
      const found = list.find((m) => m.id === id);
      if (found) {
        return found;
      }
    }
  } catch (e) {
    // getApp 在部分时机可能不可用
  }

  return list[list.length - 1];
}

/**
 * 更新已注册商户（写回 registered_merchants_v2）
 * @returns {Object|null} 更新后的商户
 */
function updateRegisteredMerchant(updates, merchantId) {
  const list = getRegisteredMerchants();
  if (!list.length) {
    return null;
  }

  let index = -1;
  if (merchantId != null) {
    index = list.findIndex((m) => m.id === merchantId);
  }
  if (index < 0) {
    const current = getCurrentRegisteredMerchant();
    if (current) {
      index = list.findIndex((m) => m.id === current.id);
    }
  }
  if (index < 0) {
    index = list.length - 1;
  }

  list[index] = { ...list[index], ...updates };
  wx.setStorageSync(STORAGE_KEY, list);
  return list[index];
}

/**
 * 省市区 + addressNormalized 完全一致视为重复；缺省市区时不判重复
 */
function isDuplicateAddressLocal(payload) {
  const addressNormalized = String(
    (payload && payload.addressNormalized) || ""
  ).trim();
  const province = String((payload && payload.province) || "").trim();
  const city = String((payload && payload.city) || "").trim();
  const county = String((payload && payload.county) || "").trim();
  const excludeId = payload && payload.excludeId;

  if (!addressNormalized || !province || !city || !county) {
    return false;
  }

  return getAllMerchants().some((item) => {
    if (excludeId != null && item.id === excludeId) {
      return false;
    }

    const itemProvince = String(item.province || "").trim();
    const itemCity = String(item.city || "").trim();
    const itemCounty = String(item.county || "").trim();
    const itemNormalized = String(item.addressNormalized || "").trim();

    if (!itemProvince || !itemCity || !itemCounty || !itemNormalized) {
      return false;
    }

    return (
      itemProvince === province &&
      itemCity === city &&
      itemCounty === county &&
      itemNormalized === addressNormalized
    );
  });
}

module.exports = {
  USE_MOCK,
  STORAGE_KEY,
  getRegisteredMerchants,
  saveRegisteredMerchant,
  getAllMerchants,
  getCurrentRegisteredMerchant,
  updateRegisteredMerchant,
  isDuplicateAddressLocal,
};
