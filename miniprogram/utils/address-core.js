// 注意：本文件有三份拷贝。
// 修改地址标准化规则时，必须同步修改 shared、miniprogram/utils、cloudfunctions/common 三处。

/**
 * 地址轻度标准化（v4.1）— 小程序与云函数共用
 */

const CN_DIGIT_MAP = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/** 仅用于「中文组号 → 阿拉伯组号」，不提取村名持久化 */
const VILLAGE_GROUP_REGEX =
  /([\u4e00-\u9fa5]+村)([\d一二三四五六七八九十两百千]+组)/;

const MEANINGLESS_SEPARATORS = /[\s\-_,，、\/]+/g;

const MERCHANT_TYPE_FARMER = "farmer";
const MERCHANT_TYPE_BUSINESS = "business";

function parseChineseNumber(text) {
  const s = String(text || "").trim();
  if (!s) return NaN;
  if (/^\d+$/.test(s)) {
    return parseInt(s, 10);
  }
  if (s === "十") return 10;
  if (s.startsWith("十")) {
    const rest = s.slice(1);
    return 10 + (rest ? parseChineseNumber(rest) : 0);
  }
  if (s.endsWith("十") && s.length > 1) {
    const headVal = parseChineseNumber(s.slice(0, -1));
    return Number.isNaN(headVal) ? NaN : headVal * 10;
  }
  if (s.includes("十")) {
    const [left, right] = s.split("十");
    const leftVal = left ? parseChineseNumber(left) : 0;
    const rightVal = right ? parseChineseNumber(right) : 0;
    if (Number.isNaN(leftVal) || Number.isNaN(rightVal)) return NaN;
    return leftVal * 10 + rightVal;
  }
  if (s.length === 1 && CN_DIGIT_MAP[s] !== undefined) {
    return CN_DIGIT_MAP[s];
  }
  return NaN;
}

function toHalfWidth(text) {
  return String(text || "")
    .replace(/[\uFF10-\uFF19]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
    )
    .replace(/[\uFF03]/g, "#");
}

function normalizeGroupNoToken(groupToken) {
  const raw = String(groupToken || "").trim();
  if (!raw) return "";

  const match = raw.match(/^([\d一二三四五六七八九十两百千]+)组$/);
  if (!match) return raw;

  const numPart = match[1];
  if (/^\d+$/.test(numPart)) {
    return `${parseInt(numPart, 10)}组`;
  }

  const num = parseChineseNumber(numPart);
  if (Number.isNaN(num) || num <= 0) {
    return raw;
  }
  return `${num}组`;
}

function normalizeChineseGroupsInText(text) {
  return String(text || "").replace(
    VILLAGE_GROUP_REGEX,
    (full, village, groupPart) => village + normalizeGroupNoToken(groupPart)
  );
}

/**
 * v4.1 轻度标准化（唯一校验用，完全一致才算重复）
 */
function computeAddressNormalized(addressRaw) {
  let s = String(addressRaw || "").trim();
  if (!s) return "";

  s = toHalfWidth(s);
  s = s.replace(/[A-Z]/g, (ch) => ch.toLowerCase());
  s = s.replace(MEANINGLESS_SEPARATORS, "");
  s = normalizeChineseGroupsInText(s);
  s = s.replace(/(\d+)[#＃]/g, "$1号");

  return s;
}

/** 尾部简单门牌：仅匹配末尾 数字+号，不做栋/单元语义 */
function extractTrailingDoorNo(normalized) {
  const match = String(normalized || "").match(/(\d+号)$/);
  return match ? match[1] : "";
}

function stripTrailingDoorNo(normalized) {
  const s = String(normalized || "");
  const door = extractTrailingDoorNo(s);
  if (!door) return s;
  const stripped = s.slice(0, -door.length);
  return stripped || s;
}

function normalizeAddress(addressRaw) {
  const raw = String(addressRaw || "").trim();
  const addressNormalized = computeAddressNormalized(raw);
  const doorNo = extractTrailingDoorNo(addressNormalized);

  return {
    addressRaw: raw,
    addressNormalized,
    doorNo,
  };
}

function buildAddressDisplay(merchantType, addressNormalized) {
  const normalized = String(addressNormalized || "");
  if (!normalized) return "";

  if (merchantType === MERCHANT_TYPE_BUSINESS) {
    return normalized;
  }

  const stripped = stripTrailingDoorNo(normalized);
  return stripped || normalized;
}

function prepareMerchantAddressFields(merchantType, addressRaw) {
  const { addressRaw: raw, addressNormalized, doorNo } =
    normalizeAddress(addressRaw);
  const addressDisplay = buildAddressDisplay(merchantType, addressNormalized);

  return {
    addressRaw: raw,
    addressNormalized,
    addressDisplay,
    doorNo,
  };
}

module.exports = {
  MERCHANT_TYPE_FARMER,
  MERCHANT_TYPE_BUSINESS,
  computeAddressNormalized,
  normalizeAddress,
  buildAddressDisplay,
  prepareMerchantAddressFields,
  stripTrailingDoorNo,
  extractTrailingDoorNo,
};
