const EARTH_RADIUS_KM = 6371;

function isValidCoord(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  return Number.isFinite(latNum) && Number.isFinite(lngNum);
}

function haversineKm(userLat, userLng, targetLat, targetLng) {
  const lat1 = (userLat * Math.PI) / 180;
  const lat2 = (targetLat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((targetLng - userLng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function formatDistance(userLat, userLng, targetLat, targetLng) {
  if (
    !isValidCoord(userLat, userLng) ||
    !isValidCoord(targetLat, targetLng)
  ) {
    return "距离未知";
  }

  const km = haversineKm(
    Number(userLat),
    Number(userLng),
    Number(targetLat),
    Number(targetLng)
  );

  if (!Number.isFinite(km) || Number.isNaN(km)) {
    return "距离未知";
  }

  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `距您${meters}米`;
  }

  return `距您${km.toFixed(1)}公里`;
}

module.exports = { formatDistance };
