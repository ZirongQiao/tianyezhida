const {
  isDuplicateAddressLocal,
  saveRegisteredMerchant,
  getCurrentRegisteredMerchant,
  updateRegisteredMerchant,
} = require("./merchant-store");

const FARMER_MSG_READ_PREFIX = "farmer_message_last_read_";
const { ADDRESS_DUPLICATE_MSG } = require("./address");

function callCloud(type, data) {
  if (!wx.cloud || !wx.cloud.callFunction) {
    return Promise.reject(new Error("cloud unavailable"));
  }
  return wx.cloud.callFunction({
    name: "quickstartFunctions",
    data: { type, ...data },
  });
}

/**
 * 地址重复校验：云数据库 + 本地 mock/缓存
 */
async function checkAddressDuplicate(payload) {
  const addressNormalized = String(payload.addressNormalized || "").trim();
  const province = String(payload.province || "").trim();
  const city = String(payload.city || "").trim();
  const county = String(payload.county || "").trim();
  if (!addressNormalized) {
    return { duplicate: false, skipped: true };
  }

  let cloudDuplicate = null;

  try {
    const res = await callCloud("checkAddressDuplicate", {
      addressNormalized,
      province,
      city,
      county,
      excludeId: payload.excludeId,
    });
    if (res.result && typeof res.result.duplicate === "boolean") {
      cloudDuplicate = res.result.duplicate;
    }
  } catch (e) {
    console.warn("[merchant-api] cloud address duplicate check fallback", e);
  }

  const localDuplicate = isDuplicateAddressLocal({
    addressNormalized,
    province,
    city,
    county,
    excludeId: payload.excludeId,
  });

  return {
    duplicate: cloudDuplicate === true || localDuplicate,
    cloudChecked: cloudDuplicate !== null,
    localDuplicate,
    message: ADDRESS_DUPLICATE_MSG,
  };
}

function stableIdFromCloudId(cloudId) {
  const hex = String(cloudId || "");
  let hash = 0;
  for (let i = 0; i < hex.length; i++) {
    hash = (hash * 31 + hex.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

/** 云库文档 → 与本地 mock 结构对齐，供地图/详情使用 */
function normalizeCloudMerchant(doc) {
  const id =
    doc.id != null && !Number.isNaN(Number(doc.id))
      ? Number(doc.id)
      : stableIdFromCloudId(doc._id);

  return {
    ...doc,
    _id: doc._id,
    id,
    name: doc.name || doc.fullMerchantName || doc.merchantName || "",
    fullMerchantName: doc.fullMerchantName || doc.name || "",
    merchantType: doc.merchantType || "farmer",
    lat: doc.lat,
    lng: doc.lng,
    categories: doc.categories || [],
    photos: doc.photos || [],
    contacts: doc.contacts || [],
    categoryWantBuy: doc.categoryWantBuy || {},
    status: doc.status,
  };
}

/**
 * 已审核商户列表（云库 merchants，status === approved）
 */
async function listMerchants() {
  try {
    const res = await callCloud("listMerchants", {});
    if (res.result && res.result.success && Array.isArray(res.result.merchants)) {
      return res.result.merchants.map(normalizeCloudMerchant);
    }
  } catch (e) {
    console.warn("[merchant-api] listMerchants failed", e);
  }
  return [];
}

/**
 * 按地图 marker id / 云文档 _id 查找单个商户（先拉 approved 列表再匹配）
 */
async function getMerchantById(id) {
  if (id == null || id === "") {
    return null;
  }
  const key = String(id);
  const list = await listMerchants();
  return (
    list.find(
      (item) =>
        String(item.id) === key ||
        String(item._id) === key
    ) || null
  );
}

/**
 * 地址地理编码（腾讯地图，云函数代理）
 * @returns {{ lat: number, lng: number } | null}
 */
async function geocodeAddress(addressNormalized) {
  const address = String(addressNormalized || "").trim();
  if (!address) return null;
  try {
    const res = await callCloud("geocodeAddress", { addressNormalized: address });
    const r = res.result;
    if (r && r.success && r.lat != null && r.lng != null) {
      return { lat: Number(r.lat), lng: Number(r.lng) };
    }
  } catch (e) {
    console.warn("[merchant-api] geocodeAddress failed", e);
  }
  return null;
}

/**
 * 当日「我想买」统计 + 当前用户是否已点（merchantId = merchants._id）
 */
async function getWantBuyState(merchantId) {
  const id = String(merchantId || "").trim();
  if (!id) {
    return { categoryWantBuy: {}, myCategories: [] };
  }
  try {
    const res = await callCloud("getWantBuyState", { merchantId: id });
    const r = res.result;
    if (r && r.success) {
      return {
        categoryWantBuy: r.categoryWantBuy || {},
        myCategories: r.myCategories || [],
      };
    }
  } catch (e) {
    console.warn("[merchant-api] getWantBuyState failed", e);
  }
  return { categoryWantBuy: {}, myCategories: [] };
}

/**
 * 切换「我想买」/ 取消（merchantId = merchants._id）
 */
async function toggleWantBuy(merchantId, category) {
  const id = String(merchantId || "").trim();
  const cat = String(category || "").trim();
  if (!id || !cat) {
    return { success: false };
  }
  try {
    const res = await callCloud("toggleWantBuy", {
      merchantId: id,
      category: cat,
    });
    const r = res.result;
    if (r && r.success) {
      return {
        success: true,
        category: r.category,
        reserved: !!r.reserved,
        wantBuyCount: r.wantBuyCount != null ? r.wantBuyCount : 0,
      };
    }
  } catch (e) {
    console.warn("[merchant-api] toggleWantBuy failed", e);
  }
  return { success: false };
}

function getFarmerMessageReadKey(merchantCloudId) {
  return `${FARMER_MSG_READ_PREFIX}${merchantCloudId}`;
}

function getFarmerMessageLastReadAt(merchantCloudId) {
  const id = String(merchantCloudId || "").trim();
  if (!id) {
    return 0;
  }
  try {
    const v = wx.getStorageSync(getFarmerMessageReadKey(id));
    return v ? Number(v) : 0;
  } catch (e) {
    return 0;
  }
}

function markFarmerMessagesRead(merchantCloudId, readAtMs) {
  const id = String(merchantCloudId || "").trim();
  if (!id) {
    return;
  }
  const at = readAtMs != null && !Number.isNaN(Number(readAtMs))
    ? Number(readAtMs)
    : Date.now();
  try {
    wx.setStorageSync(getFarmerMessageReadKey(id), at);
  } catch (e) {
    // ignore
  }
}

/**
 * 当前农户云文档 _id（want_buys.merchantId）
 */
async function resolveCurrentFarmerCloudId() {
  const m = getCurrentRegisteredMerchant();
  if (!m) {
    return "";
  }
  if (m._id) {
    return String(m._id);
  }

  const key = String(m.addressNormalized || "").trim();
  if (!key) {
    return "";
  }

  try {
    const res = await callCloud("listMerchants", {});
    const rows =
      res.result && res.result.success && Array.isArray(res.result.merchants)
        ? res.result.merchants
        : [];
    const found = rows.find(
      (row) => String(row.addressNormalized || "").trim() === key
    );
    if (found && found._id) {
      updateRegisteredMerchant({ _id: found._id }, m.id);
      return String(found._id);
    }
  } catch (e) {
    console.warn("[merchant-api] resolveCurrentFarmerCloudId failed", e);
  }

  return "";
}

/**
 * 农户消息列表（want_buys，按 createdAt 倒序）
 */
async function listWantBuyMessages(merchantCloudId) {
  const id = String(merchantCloudId || "").trim();
  if (!id) {
    return [];
  }
  try {
    const res = await callCloud("listWantBuyMessages", { merchantId: id });
    const r = res.result;
    if (r && r.success && Array.isArray(r.messages)) {
      return r.messages;
    }
  } catch (e) {
    console.warn("[merchant-api] listWantBuyMessages failed", e);
  }
  return [];
}

/**
 * 当前商户最新一条 want_buys 的 createdAt（毫秒）
 */
async function getWantBuyLatestCreatedAt(merchantCloudId) {
  const id = String(merchantCloudId || "").trim();
  if (!id) {
    return 0;
  }
  try {
    const res = await callCloud("getWantBuyLatestCreatedAt", { merchantId: id });
    const r = res.result;
    if (r && r.success && r.latestCreatedAtMs != null) {
      return Number(r.latestCreatedAtMs) || 0;
    }
  } catch (e) {
    console.warn("[merchant-api] getWantBuyLatestCreatedAt failed", e);
  }
  return 0;
}

/**
 * step2：创建云库入驻草稿（status = draft）
 */
async function createMerchantDraft(draft) {
  try {
    const res = await callCloud("createMerchantDraft", { draft });
    const r = res.result;
    if (r && r.success && r._id) {
      return { success: true, _id: r._id };
    }
  } catch (e) {
    console.warn("[merchant-api] createMerchantDraft failed", e);
  }
  return { success: false };
}

/**
 * step3：提交入驻草稿（draft → pending，更新同一条文档）
 */
async function submitMerchantDraft(merchantId, merchant) {
  const id = String(merchantId || "").trim();
  if (!id) {
    return { success: false };
  }

  try {
    const res = await callCloud("submitMerchantDraft", { merchantId: id, merchant });
    const r = res.result;
    if (r && r.duplicate) {
      return { success: false, duplicate: true };
    }
    if (r && r.success) {
      const toSave = {
        ...merchant,
        _id: id,
        status: "pending",
      };
      saveRegisteredMerchant(toSave);
      return { success: true, cloudOk: true, cloudId: id };
    }
  } catch (e) {
    console.warn("[merchant-api] submitMerchantDraft failed", e);
  }
  return { success: false };
}

/**
 * 货品管理：更新云库在售品类
 */
async function updateMerchantCategories(merchantId, categories) {
  const id = String(merchantId || "").trim();
  if (!id || !Array.isArray(categories)) {
    return { success: false };
  }

  try {
    const res = await callCloud("updateMerchantCategories", {
      merchantId: id,
      categories,
    });
    if (res.result && res.result.success) {
      return { success: true };
    }
  } catch (e) {
    console.warn("[merchant-api] updateMerchantCategories failed", e);
  }
  return { success: false };
}

/**
 * 农户主页：更新云库头像与相册
 */
async function updateMerchantProfile(merchantId, payload) {
  const id = String(merchantId || "").trim();
  if (!id) {
    return { success: false };
  }

  try {
    const res = await callCloud("updateMerchantProfile", {
      merchantId: id,
      payload,
    });
    if (res.result && res.result.success) {
      return { success: true };
    }
  } catch (e) {
    console.warn("[merchant-api] updateMerchantProfile failed", e);
  }
  return { success: false };
}

/**
 * 查询当前 openid 是否已绑定农户（ownerOpenid）
 */
async function getMyBoundMerchant() {
  try {
    const res = await callCloud("getMyBoundMerchant", {});
    const r = res.result;
    if (r && r.success) {
      return {
        success: true,
        merchant: r.merchant ? normalizeCloudMerchant(r.merchant) : null,
      };
    }
  } catch (e) {
    console.warn("[merchant-api] getMyBoundMerchant failed", e);
  }
  return { success: false, merchant: null };
}

/**
 * 提交手机号认领申请
 */
async function submitClaimRequest(phone) {
  try {
    const res = await callCloud("submitClaimRequest", { phone });
    const r = res.result;
    if (r && typeof r.success === "boolean") {
      return {
        success: r.success,
        message: r.message || "",
        duplicate: r.duplicate === true,
      };
    }
  } catch (e) {
    console.warn("[merchant-api] submitClaimRequest failed", e);
  }
  return { success: false, message: "网络异常，请重试" };
}

module.exports = {
  checkAddressDuplicate,
  listMerchants,
  getMerchantById,
  geocodeAddress,
  getWantBuyState,
  toggleWantBuy,
  resolveCurrentFarmerCloudId,
  listWantBuyMessages,
  getWantBuyLatestCreatedAt,
  getFarmerMessageLastReadAt,
  markFarmerMessagesRead,
  createMerchantDraft,
  submitMerchantDraft,
  updateMerchantCategories,
  updateMerchantProfile,
  getMyBoundMerchant,
  submitClaimRequest,
};
