/**
 * 商户类型与 PRD 规则（地图颜色、名称拼接）
 */

const MERCHANT_TYPE = {
  FARMER: "farmer",
  BUSINESS: "business",
};

/** 地图气泡 / 类型标签颜色 */
const MERCHANT_THEME = {
  [MERCHANT_TYPE.FARMER]: {
    bubbleColor: "#4CAF50",
    tagBg: "#E8F5E9",
    tagColor: "#4CAF50",
    label: "农户",
  },
  [MERCHANT_TYPE.BUSINESS]: {
    bubbleColor: "#FF9800",
    tagBg: "#FFF3E0",
    tagColor: "#FF9800",
    label: "经营性商户",
  },
};

const FORM_ERRORS = {
  MERCHANT_NAME_EMPTY: "请输入商户名称",
  REGION_EMPTY: "请选择所在地区",
  ADDRESS_EMPTY: "请输入详细地址",
  ADDRESS_DUPLICATE: "该地址已经注册，请核实后重新输入",
};

function buildFullMerchantName(merchantType, merchantName) {
  const raw = (merchantName || "").trim();
  if (!raw) return "";
  if (merchantType === MERCHANT_TYPE.FARMER) {
    return raw.endsWith("家") ? raw : `${raw}家`;
  }
  return raw;
}

function resolveMerchantType(merchant) {
  if (merchant.merchantType === MERCHANT_TYPE.BUSINESS) {
    return MERCHANT_TYPE.BUSINESS;
  }
  if (merchant.merchantType === MERCHANT_TYPE.FARMER) {
    return MERCHANT_TYPE.FARMER;
  }
  const name = merchant.fullMerchantName || merchant.name || "";
  if (name.endsWith("家")) {
    return MERCHANT_TYPE.FARMER;
  }
  return MERCHANT_TYPE.BUSINESS;
}

function getMerchantTheme(merchant) {
  const type = resolveMerchantType(merchant);
  return {
    type,
    ...MERCHANT_THEME[type],
  };
}

function getMapBubbleColor(merchant) {
  return getMerchantTheme(merchant).bubbleColor;
}

module.exports = {
  MERCHANT_TYPE,
  MERCHANT_THEME,
  FORM_ERRORS,
  buildFullMerchantName,
  resolveMerchantType,
  getMerchantTheme,
  getMapBubbleColor,
};
