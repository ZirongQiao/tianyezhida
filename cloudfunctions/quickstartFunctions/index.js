const cloud = require("wx-server-sdk");
const https = require("https");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// 更新数据
const updateRecord = async (event) => {
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            sales: event.data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  try {
    const insertRecord = event.data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  try {
    await db
      .collection("sales")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

const MERCHANTS_COLLECTION = "merchants";
const WANT_BUYS_COLLECTION = "want_buys";
const addressCore = require("./common/address-core");

const getDateKeyChina = () => {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toCreatedAtMs = (createdAt) => {
  if (!createdAt) {
    return 0;
  }
  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }
  if (typeof createdAt === "object" && createdAt.$date) {
    return new Date(createdAt.$date).getTime();
  }
  const ms = new Date(createdAt).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

const listWantBuyMessages = async (event) => {
  const merchantId = String(event.merchantId || "").trim();
  if (!merchantId) {
    return { success: false, messages: [], errMsg: "missing merchantId" };
  }

  try {
    const res = await db
      .collection(WANT_BUYS_COLLECTION)
      .where({ merchantId, status: "active" })
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const messages = (res.data || []).map((row) => ({
      _id: row._id,
      buyerNickName: row.buyerNickName || "",
      category: row.category || "",
      createdAtMs: toCreatedAtMs(row.createdAt),
    }));

    return { success: true, messages };
  } catch (e) {
    return {
      success: false,
      messages: [],
      errMsg: e.message || String(e),
    };
  }
};

const getWantBuyLatestCreatedAt = async (event) => {
  const merchantId = String(event.merchantId || "").trim();
  if (!merchantId) {
    return { success: false, latestCreatedAtMs: 0, errMsg: "missing merchantId" };
  }

  try {
    const res = await db
      .collection(WANT_BUYS_COLLECTION)
      .where({ merchantId, status: "active" })
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    const row = res.data && res.data[0];
    return {
      success: true,
      latestCreatedAtMs: row ? toCreatedAtMs(row.createdAt) : 0,
    };
  } catch (e) {
    return {
      success: false,
      latestCreatedAtMs: 0,
      errMsg: e.message || String(e),
    };
  }
};

const countActiveWantBuys = async (merchantId, dateKey, category) => {
  const where = { merchantId, dateKey, status: "active" };
  if (category) {
    where.category = category;
  }
  const res = await db.collection(WANT_BUYS_COLLECTION).where(where).count();
  return res.total || 0;
};

const getWantBuyState = async (event) => {
  const merchantId = String(event.merchantId || "").trim();
  if (!merchantId) {
    return { success: false, errMsg: "missing merchantId" };
  }

  const dateKey = getDateKeyChina();
  const openid = cloud.getWXContext().OPENID || "";

  try {
    const res = await db
      .collection(WANT_BUYS_COLLECTION)
      .where({ merchantId, dateKey, status: "active" })
      .get();
    const rows = res.data || [];
    const categoryWantBuy = {};
    const myCategories = [];

    rows.forEach((row) => {
      const cat = row.category;
      if (!cat) {
        return;
      }
      categoryWantBuy[cat] = (categoryWantBuy[cat] || 0) + 1;
      if (openid && row.openid === openid) {
        myCategories.push(cat);
      }
    });

    return {
      success: true,
      categoryWantBuy,
      myCategories,
    };
  } catch (e) {
    return {
      success: false,
      categoryWantBuy: {},
      myCategories: [],
      errMsg: e.message || String(e),
    };
  }
};

const toggleWantBuy = async (event) => {
  const merchantId = String(event.merchantId || "").trim();
  const category = String(event.category || "").trim();
  if (!merchantId || !category) {
    return { success: false, errMsg: "missing merchantId or category" };
  }

  const openid = cloud.getWXContext().OPENID;
  if (!openid) {
    return { success: false, errMsg: "missing openid" };
  }

  const dateKey = getDateKeyChina();

  try {
    const existing = await db
      .collection(WANT_BUYS_COLLECTION)
      .where({
        merchantId,
        category,
        openid,
        dateKey,
        status: "active",
      })
      .limit(1)
      .get();

    let reserved = false;
    if (existing.data && existing.data.length > 0) {
      await db
        .collection(WANT_BUYS_COLLECTION)
        .doc(existing.data[0]._id)
        .update({
          data: {
            status: "cancelled",
            updatedAt: db.serverDate(),
          },
        });
      reserved = false;
    } else {
      await db.collection(WANT_BUYS_COLLECTION).add({
        data: {
          merchantId,
          category,
          openid,
          dateKey,
          status: "active",
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        },
      });
      reserved = true;
    }

    const wantBuyCount = await countActiveWantBuys(
      merchantId,
      dateKey,
      category
    );

    return {
      success: true,
      category,
      reserved,
      wantBuyCount,
    };
  } catch (e) {
    if (/not exist|不存在|502005/.test(String(e.message || e.errMsg || ""))) {
      try {
        await db.createCollection(WANT_BUYS_COLLECTION);
      } catch (createErr) {
        // collection may already exist
      }
      return toggleWantBuy(event);
    }
    return { success: false, errMsg: e.message || String(e) };
  }
};

const ADDRESS_DUPLICATE_MSG = "该地址已经注册，请核实后重新输入";

const pickMerchantAddressPayload = (merchant) => {
  const merchantType = merchant.merchantType || "farmer";
  const fields = addressCore.prepareMerchantAddressFields(
    merchantType,
    merchant.addressRaw || ""
  );

  return {
    addressRaw: fields.addressRaw,
    addressNormalized: fields.addressNormalized,
    addressDisplay: fields.addressDisplay,
    doorNo: fields.doorNo || "",
    province: merchant.province || "",
    city: merchant.city || "",
    county: merchant.county || "",
    town: merchant.town || "",
  };
};

const checkAddressDuplicate = async (event) => {
  const addressNormalized = String(event.addressNormalized || "").trim();
  const province = String(event.province || "").trim();
  const city = String(event.city || "").trim();
  const county = String(event.county || "").trim();
  const { excludeId } = event;
  const _ = db.command;

  if (!addressNormalized) {
    return { duplicate: false, skipped: true };
  }

  if (!province || !city || !county) {
    return { duplicate: false, skipped: true };
  }

  try {
    const detail = await db
      .collection(MERCHANTS_COLLECTION)
      .where({
        province,
        city,
        county,
        addressNormalized,
        status: _.in(["pending", "approved"]),
      })
      .get();

    const rows = detail.data || [];
    if (!rows.length) {
      return { duplicate: false };
    }

    if (excludeId == null) {
      return { duplicate: true, message: ADDRESS_DUPLICATE_MSG };
    }

    const others = rows.filter((row) => String(row._id) !== String(excludeId));
    return {
      duplicate: others.length > 0,
      message: ADDRESS_DUPLICATE_MSG,
    };
  } catch (e) {
    return { duplicate: false, error: e.message || String(e) };
  }
};

const geocodeAddress = async (event) => {
  const addressNormalized = String(event.addressNormalized || "").trim();
  const key = process.env.TENCENT_MAP_KEY || "";
  if (!addressNormalized) {
    return { success: false, errMsg: "empty address" };
  }
  if (!key) {
    return { success: false, errMsg: "missing TENCENT_MAP_KEY" };
  }

  const query = `address=${encodeURIComponent(addressNormalized)}&key=${encodeURIComponent(key)}`;
  const url = `https://apis.map.qq.com/ws/geocoder/v1/?${query}`;

  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        try {
          const body = JSON.parse(raw);
          if (body.status === 0 && body.result && body.result.location) {
            resolve({
              success: true,
              lat: body.result.location.lat,
              lng: body.result.location.lng,
            });
            return;
          }
          resolve({
            success: false,
            errMsg: body.message || `geocode status ${body.status}`,
          });
        } catch (e) {
          resolve({ success: false, errMsg: e.message || String(e) });
        }
      });
    });
    req.on("error", (e) => {
      resolve({ success: false, errMsg: e.message || String(e) });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ success: false, errMsg: "timeout" });
    });
  });
};

/** 买家端地图/详情可见字段（剔除 openid、协议授权、后台字段） */
const PUBLIC_MERCHANT_FIELDS = [
  "_id",
  "id",
  "merchantType",
  "name",
  "fullMerchantName",
  "merchantName",
  "contacts",
  "province",
  "city",
  "county",
  "town",
  "region",
  "regionText",
  "addressRaw",
  "addressNormalized",
  "addressDisplay",
  "doorNo",
  "lat",
  "lng",
  "categories",
  "photos",
  "avatarUrl",
  "categoryWantBuy",
  "status",
  "createdAt",
  "updatedAt",
];

function pickPublicMerchantFields(doc) {
  if (!doc || typeof doc !== "object") {
    return {};
  }
  const out = {};
  for (let i = 0; i < PUBLIC_MERCHANT_FIELDS.length; i++) {
    const key = PUBLIC_MERCHANT_FIELDS[i];
    if (doc[key] !== undefined) {
      out[key] = doc[key];
    }
  }
  return out;
}

const listMerchants = async () => {
  try {
    const res = await db
      .collection(MERCHANTS_COLLECTION)
      .where({ status: "approved" })
      .get();
    const merchants = (res.data || [])
      .filter((m) => Array.isArray(m.categories) && m.categories.length > 0)
      .map(pickPublicMerchantFields);
    return {
      success: true,
      merchants,
    };
  } catch (e) {
    return {
      success: false,
      merchants: [],
      errMsg: e.message || String(e),
    };
  }
};

const getMyBoundMerchant = async () => {
  const openid = cloud.getWXContext().OPENID || "";
  if (!openid) {
    return { success: false, errMsg: "missing openid" };
  }

  try {
    const res = await db
      .collection(MERCHANTS_COLLECTION)
      .where({ ownerOpenid: openid })
      .limit(1)
      .get();
    const merchant = (res.data && res.data[0]) || null;
    return { success: true, merchant };
  } catch (e) {
    return {
      success: false,
      errMsg: e.message || String(e),
      merchant: null,
    };
  }
};

const CLAIM_REQUESTS_COLLECTION = "claim_requests";

const isCollectionNotExistError = (err) =>
  /not exist|不存在|502005|DATABASE_COLLECTION_NOT_EXIST|ResourceNotFound/i.test(
    String((err && (err.message || err.errMsg)) || err)
  );

const ensureClaimRequestsCollection = async () => {
  try {
    await db.createCollection(CLAIM_REQUESTS_COLLECTION);
  } catch (e) {
    if (
      !/already exist|已存在|ResourceAlreadyExists|Table exist|502006/i.test(
        String((e && (e.message || e.errMsg)) || e)
      )
    ) {
      throw e;
    }
  }
};

const mapClaimRequestErrorMessage = (err) => {
  if (isCollectionNotExistError(err)) {
    return "认领服务正在初始化，请稍后重试。";
  }
  console.error("[submitClaimRequest] unexpected error", err);
  return "提交失败，请稍后重试";
};

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

const normalizeClaimMobilePhone = (phone) => {
  const normalized = digitsOnly(phone);
  if (!/^1\d{10}$/.test(normalized)) {
    return null;
  }
  return normalized;
};

const merchantMatchesPhone = (merchant, normalizedPhone) => {
  if (!merchant) {
    return false;
  }

  if (digitsOnly(merchant.phone) === normalizedPhone) {
    return true;
  }

  if (digitsOnly(merchant.contactPhone) === normalizedPhone) {
    return true;
  }

  const contacts = merchant.contacts || [];
  for (const contact of contacts) {
    if (!contact) {
      continue;
    }
    if (digitsOnly(contact.normalized) === normalizedPhone) {
      return true;
    }
    if (digitsOnly(contact.raw) === normalizedPhone) {
      return true;
    }
  }

  return false;
};

const findMerchantByPhone = async (normalizedPhone) => {
  const col = db.collection(MERCHANTS_COLLECTION);

  const [byPhone, byContactPhone, byContactsNormalized] = await Promise.all([
    col.where({ phone: normalizedPhone }).limit(10).get(),
    col.where({ contactPhone: normalizedPhone }).limit(10).get(),
    col.where({ "contacts.normalized": normalizedPhone }).limit(10).get(),
  ]);

  const candidates = new Map();
  [
    ...(byPhone.data || []),
    ...(byContactPhone.data || []),
    ...(byContactsNormalized.data || []),
  ].forEach((merchant) => {
    if (merchant && merchant._id) {
      candidates.set(merchant._id, merchant);
    }
  });

  for (const merchant of candidates.values()) {
    if (merchantMatchesPhone(merchant, normalizedPhone)) {
      return merchant;
    }
  }

  return null;
};

const getMerchantDisplayName = (merchant) =>
  merchant.merchantName ||
  merchant.fullMerchantName ||
  merchant.name ||
  "";

const MERCHANT_CLAIMED_MSG =
  "该电话已绑定农户。";

const submitClaimRequest = async (event) => {
  const openid = cloud.getWXContext().OPENID || "";
  if (!openid) {
    return { success: false, message: "missing openid" };
  }

  const normalizedPhone = normalizeClaimMobilePhone(event.phone);
  if (!normalizedPhone) {
    return { success: false, message: "请输入正确的手机号" };
  }

  try {
    const merchant = await findMerchantByPhone(normalizedPhone);
    if (!merchant) {
      return {
        success: false,
        message:
          "未找到该手机号对应的农户信息。",
      };
    }

    if (merchant.ownerOpenid && String(merchant.ownerOpenid).trim()) {
      return {
        success: false,
        message: MERCHANT_CLAIMED_MSG,
      };
    }

    const merchantId = String(merchant._id);
    await ensureClaimRequestsCollection();

    const approvedRes = await db
      .collection(CLAIM_REQUESTS_COLLECTION)
      .where({
        merchantId,
        status: "approved",
      })
      .limit(1)
      .get();

    if (approvedRes.data && approvedRes.data.length > 0) {
      return {
        success: false,
        message: MERCHANT_CLAIMED_MSG,
      };
    }

    const pendingRes = await db
      .collection(CLAIM_REQUESTS_COLLECTION)
      .where({
        merchantId,
        applicantOpenid: openid,
        status: "pending",
      })
      .limit(1)
      .get();

    if (pendingRes.data && pendingRes.data.length > 0) {
      return {
        success: true,
        message: "您已提交认领申请，请等待平台审核。",
        duplicate: true,
      };
    }

    const claimData = {
      merchantId,
      merchantName: getMerchantDisplayName(merchant),
      phone: normalizedPhone,
      applicantOpenid: openid,
      status: "pending",
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    };

    await db.collection(CLAIM_REQUESTS_COLLECTION).add({ data: claimData });

    return {
      success: true,
      message: "您已提交认领申请，请等待平台审核。",
    };
  } catch (e) {
    return {
      success: false,
      message: mapClaimRequestErrorMessage(e),
    };
  }
};

const approveClaimRequest = async (event) => {
  const requestId = String(event.requestId || "").trim();
  if (!requestId) {
    return { success: false, message: "missing requestId" };
  }

  try {
    const requestRes = await db
      .collection(CLAIM_REQUESTS_COLLECTION)
      .doc(requestId)
      .get();
    const request = requestRes.data;

    if (!request) {
      return { success: false, message: "认领申请不存在" };
    }

    if (request.status === "approved") {
      return { success: false, message: "该认领申请已审核通过" };
    }

    const merchantId = String(request.merchantId || "").trim();
    const applicantOpenid = String(request.applicantOpenid || "").trim();

    if (!merchantId || !applicantOpenid) {
      return { success: false, message: "认领申请数据不完整" };
    }

    const merchantRes = await db
      .collection(MERCHANTS_COLLECTION)
      .doc(merchantId)
      .get();
    const merchant = merchantRes.data;

    if (!merchant) {
      return { success: false, message: "对应农户不存在" };
    }

    if (merchant.ownerOpenid && String(merchant.ownerOpenid).trim()) {
      return {
        success: false,
        message: "该电话已绑定农户。",
      };
    }

    await db.collection(MERCHANTS_COLLECTION).doc(merchantId).update({
      data: {
        ownerOpenid: applicantOpenid,
        ownerBindAt: db.serverDate(),
        ownerBindSource: "claim_request",
        ownerClaimRequestId: requestId,
        updatedAt: db.serverDate(),
      },
    });

    await db.collection(CLAIM_REQUESTS_COLLECTION).doc(requestId).update({
      data: {
        status: "approved",
        approvedAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    });

    return {
      success: true,
      message: "认领申请已通过，农户已绑定",
    };
  } catch (e) {
    console.error("[approveClaimRequest] unexpected error", e);
    return {
      success: false,
      message: e.message || String(e),
    };
  }
};

const createMerchantDraft = async (event) => {
  const draft = event.draft || {};
  const openid = cloud.getWXContext().OPENID || "";

  if (!openid) {
    return { success: false, errMsg: "missing openid" };
  }

  const data = {
    merchantType: draft.merchantType,
    merchantName: draft.merchantName,
    fullMerchantName: draft.fullMerchantName,
    contacts: draft.contacts || [],
    region: draft.region || [],
    regionText: draft.regionText || "",
    province: draft.province || "",
    city: draft.city || "",
    county: draft.county || "",
    town: draft.town || "",
    addressRaw: draft.addressRaw || "",
    addressNormalized: draft.addressNormalized || "",
    addressDisplay: draft.addressDisplay || "",
    doorNo: draft.doorNo || "",
    status: "draft",
    openid,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  };

  try {
    const addRes = await db.collection(MERCHANTS_COLLECTION).add({ data });
    return { success: true, _id: addRes._id };
  } catch (e) {
    if (/not exist|不存在|502005/.test(String(e.message || e.errMsg || ""))) {
      try {
        await db.createCollection(MERCHANTS_COLLECTION);
      } catch (createErr) {
        // collection may already exist
      }
      const addRes = await db.collection(MERCHANTS_COLLECTION).add({ data });
      return { success: true, _id: addRes._id };
    }
    return { success: false, errMsg: e.message || String(e) };
  }
};

const submitMerchantDraft = async (event) => {
  const merchantId = String(event.merchantId || event._id || "").trim();
  const { merchant } = event;

  if (!merchantId || !merchant) {
    return { success: false, errMsg: "missing merchantId or merchant" };
  }

  const addressRawInput = String(merchant.addressRaw || "").trim();
  if (!addressRawInput) {
    return {
      success: false,
      message: "请输入详细地址",
    };
  }

  try {
    const docRes = await db.collection(MERCHANTS_COLLECTION).doc(merchantId).get();
    const existing = docRes.data;
    if (!existing) {
      return { success: false, errMsg: "draft not found" };
    }
    if (existing.status !== "draft") {
      return { success: false, errMsg: "invalid draft status" };
    }

    const addressPayload = pickMerchantAddressPayload({
      ...merchant,
      addressRaw: addressRawInput,
    });

    const dup = await checkAddressDuplicate({
      addressNormalized: addressPayload.addressNormalized,
      province: addressPayload.province,
      city: addressPayload.city,
      county: addressPayload.county,
      excludeId: merchantId,
    });

    if (dup.duplicate) {
      return {
        success: false,
        duplicate: true,
        message: ADDRESS_DUPLICATE_MSG,
      };
    }

    const data = {
      merchantType: merchant.merchantType,
      name: merchant.name,
      fullMerchantName: merchant.fullMerchantName,
      merchantName: merchant.merchantName,
      contacts: merchant.contacts,
      province: addressPayload.province,
      city: addressPayload.city,
      county: addressPayload.county,
      town: addressPayload.town,
      regionText: merchant.regionText,
      addressRaw: addressPayload.addressRaw,
      addressNormalized: addressPayload.addressNormalized,
      addressDisplay: addressPayload.addressDisplay,
      doorNo: addressPayload.doorNo,
      lat: merchant.lat,
      lng: merchant.lng,
      categories: merchant.categories,
      photos: merchant.photos,
      avatarUrl: merchant.avatarUrl || merchant.avatar || "",
      status: "pending",
      updatedAt: db.serverDate(),
    };

    if (merchant.agreementAccepted === true) {
      data.agreementAccepted = true;
      data.agreementAcceptedAt = db.serverDate();
    }

    if (merchant.privacyAccepted === true) {
      data.privacyAccepted = true;
      data.privacyAcceptedAt = db.serverDate();
    }

    if (merchant.authorizationAccepted === true) {
      data.authorizationAccepted = true;
      data.authorizationAcceptedAt = db.serverDate();
    }

    await db.collection(MERCHANTS_COLLECTION).doc(merchantId).update({ data });

    return { success: true, _id: merchantId };
  } catch (e) {
    return { success: false, errMsg: e.message || String(e) };
  }
};

const updateMerchantProfile = async (event) => {
  const merchantId = String(event.merchantId || "").trim();
  const payload = event.payload || {};

  if (!merchantId) {
    return { success: false, errMsg: "missing merchantId" };
  }

  try {
    const docRes = await db.collection(MERCHANTS_COLLECTION).doc(merchantId).get();
    if (!docRes.data) {
      return { success: false, errMsg: "merchant not found" };
    }

    const data = {
      updatedAt: db.serverDate(),
    };

    if (payload.avatarUrl !== undefined) {
      data.avatarUrl = payload.avatarUrl || "";
    }
    if (payload.photos !== undefined) {
      data.photos = payload.photos;
    }
    if (payload.name !== undefined) {
      data.name = payload.name || "";
    }
    if (payload.fullMerchantName !== undefined) {
      data.fullMerchantName = payload.fullMerchantName || "";
    }
    if (payload.merchantName !== undefined) {
      data.merchantName = payload.merchantName || "";
    }
    if (payload.contacts !== undefined) {
      data.contacts = payload.contacts;
    }

    await db.collection(MERCHANTS_COLLECTION).doc(merchantId).update({ data });

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message || String(e) };
  }
};

const updateMerchantCategories = async (event) => {
  const merchantId = String(event.merchantId || "").trim();
  const categories = event.categories;

  if (!merchantId) {
    return { success: false, errMsg: "missing merchantId" };
  }

  if (!Array.isArray(categories)) {
    return { success: false, errMsg: "invalid categories" };
  }

  try {
    const docRes = await db.collection(MERCHANTS_COLLECTION).doc(merchantId).get();
    if (!docRes.data) {
      return { success: false, errMsg: "merchant not found" };
    }

    await db.collection(MERCHANTS_COLLECTION).doc(merchantId).update({
      data: {
        categories,
        updatedAt: db.serverDate(),
      },
    });

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message || String(e) };
  }
};

const createMerchant = async (event) => {
  const { merchant } = event;
  if (!merchant) {
    return { success: false, errMsg: "missing merchant" };
  }

  const addressRawInput = String(merchant.addressRaw || "").trim();
  if (!addressRawInput) {
    return {
      success: false,
      message: "请输入详细地址",
    };
  }

  const addressPayload = pickMerchantAddressPayload({
    ...merchant,
    addressRaw: addressRawInput,
  });

  const dup = await checkAddressDuplicate({
    addressNormalized: addressPayload.addressNormalized,
    province: addressPayload.province,
    city: addressPayload.city,
    county: addressPayload.county,
  });

  if (dup.duplicate) {
    return {
      success: false,
      duplicate: true,
      message: ADDRESS_DUPLICATE_MSG,
    };
  }

  const data = {
    merchantType: merchant.merchantType,
    name: merchant.name,
    fullMerchantName: merchant.fullMerchantName,
    merchantName: merchant.merchantName,
    contacts: merchant.contacts,
    lat: merchant.lat,
    lng: merchant.lng,
    categories: merchant.categories,
    photos: merchant.photos,
    avatarUrl: merchant.avatarUrl || merchant.avatar || "",
    status: merchant.status,
    regionText: merchant.regionText,
    ...addressPayload,
    createdAt: db.serverDate(),
  };

  try {
    const addRes = await db.collection(MERCHANTS_COLLECTION).add({ data });
    return { success: true, _id: addRes._id };
  } catch (e) {
    if (/not exist|不存在|502005/.test(String(e.message || e.errMsg || ""))) {
      try {
        await db.createCollection(MERCHANTS_COLLECTION);
      } catch (createErr) {
        // collection may already exist
      }
      const addRes = await db.collection(MERCHANTS_COLLECTION).add({ data });
      return { success: true, _id: addRes._id };
    }
    return { success: false, errMsg: e.message || String(e) };
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    case "checkAddressDuplicate":
      return await checkAddressDuplicate(event);
    case "listMerchants":
      return await listMerchants();
    case "getMyBoundMerchant":
      return await getMyBoundMerchant();
    case "submitClaimRequest":
      return await submitClaimRequest(event);
    case "approveClaimRequest":
      return await approveClaimRequest(event);
    case "geocodeAddress":
      return await geocodeAddress(event);
    case "createMerchantDraft":
      return await createMerchantDraft(event);
    case "submitMerchantDraft":
      return await submitMerchantDraft(event);
    case "updateMerchantProfile":
      return await updateMerchantProfile(event);
    case "updateMerchantCategories":
      return await updateMerchantCategories(event);
    case "createMerchant":
      return await createMerchant(event);
    case "getWantBuyState":
      return await getWantBuyState(event);
    case "toggleWantBuy":
      return await toggleWantBuy(event);
    case "listWantBuyMessages":
      return await listWantBuyMessages(event);
    case "getWantBuyLatestCreatedAt":
      return await getWantBuyLatestCreatedAt(event);
  }
};
