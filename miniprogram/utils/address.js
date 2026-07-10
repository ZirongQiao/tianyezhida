/**
 * 地址模块（v4.1）— 展示与校验入口，标准化逻辑见 shared/address-core.js
 */

const core = require("./address-core");

const ADDRESS_DUPLICATE_MSG = "该地址已经注册，请核实后重新输入";
const ADDRESS_EMPTY_MSG = "请输入详细地址";

function validateAddress(addressRaw) {
  const raw = String(addressRaw || "").trim();
  if (!raw) {
    return { ok: false, message: ADDRESS_EMPTY_MSG };
  }
  return { ok: true, message: "" };
}

function buildDetailAddressLines(merchant) {
  const province = merchant.province || "";
  const city = merchant.city || "";
  const regionLine = [province, city].filter(Boolean).join(" | ");

  const detailLine =
    merchant.addressDisplay ||
    core.buildAddressDisplay(
      merchant.merchantType,
      merchant.addressNormalized ||
        core.computeAddressNormalized(merchant.addressRaw || "")
    );

  return { regionLine, detailLine };
}

module.exports = {
  ADDRESS_DUPLICATE_MSG,
  ADDRESS_EMPTY_MSG,
  normalizeAddress: core.normalizeAddress,
  prepareMerchantAddressFields: core.prepareMerchantAddressFields,
  computeAddressNormalized: core.computeAddressNormalized,
  buildAddressDisplay: core.buildAddressDisplay,
  validateAddress,
  buildDetailAddressLines,
};
