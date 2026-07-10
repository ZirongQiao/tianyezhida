/**
 * 商户头像：统一 avatarUrl，photos[0] 兜底，否则姓氏占位
 */

function resolveMerchantAvatarUrl(merchant) {
  if (!merchant) {
    return "";
  }

  const direct = merchant.avatarUrl || merchant.avatar || "";
  if (direct) {
    return direct;
  }

  const photos = merchant.photos || [];
  for (let i = 0; i < photos.length; i++) {
    if (photos[i]) {
      return photos[i];
    }
  }

  return "";
}

function getMerchantAvatarInitial(merchant) {
  const name = (merchant && (merchant.fullMerchantName || merchant.name)) || "";
  return name.charAt(0) || "农";
}

module.exports = {
  resolveMerchantAvatarUrl,
  getMerchantAvatarInitial,
};
