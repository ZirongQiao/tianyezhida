/**
 * 农户导航（地图小卡片 + 详情页共用 handleNavigateToFarmer）
 *
 * 开发者工具中无法完全验证外部地图 App 跳转，必须真机预览测试。
 * 不使用 wx.openLocation、qqmap://、iosamap://、baidumap://。
 *
 * 真机优先：MapContext.openMapApp（拉起本机地图 App，需 map 页注册上下文）
 * 其次：wx.navigateToMiniProgram（需在 app.json 配置 navigateToMiniProgramAppIdList）
 */

const DEVTOOLS_TOAST = "请在手机真机微信中测试导航跳转";

/** 腾讯地图小程序 */
const TENCENT_MINI_APP_ID = "wx6185fdad38812f4d";

/** 高德地图小程序 */
const AMAP_MINI_APP_ID = "wx7697e27ffced5aad";

/** 百度地图小程序 */
const BAIDU_MINI_APP_ID = "wx91d6dce07756540f";

const MAP_KEYS = ["tencent", "amap", "baidu"];

/** openMapApp 的 preferApplication 取值 */
const MAP_APP_PREFER = {
  tencent: "tencent",
  amap: "amap",
  baidu: "baidu",
};

/** 各地图小程序跳转配置 */
const MAP_MINI_CONFIG = {
  tencent: {
    appId: TENCENT_MINI_APP_ID,
    label: "腾讯地图",
    buildPath(lat, lng, encodedName) {
      return `pages/route/route?type=drive&to=${encodedName}&tocoord=${lat},${lng}`;
    },
  },
  amap: {
    appId: AMAP_MINI_APP_ID,
    label: "高德地图",
    buildPath(lat, lng, encodedName) {
      return `pages/plan/plan?dlat=${lat}&dlon=${lng}&dname=${encodedName}&dev=0&t=0`;
    },
  },
  baidu: {
    appId: BAIDU_MINI_APP_ID,
    label: "百度地图",
    buildPath(lat, lng, encodedName) {
      return `pages/navi/navi?lat=${lat}&lng=${lng}&title=${encodedName}`;
    },
  },
};

let mapContext = null;

/**
 * 在含 <map id="mainMap"> 的页面 onReady 中调用，用于真机 openMapApp
 * @param {string} mapId - 与 wxml 中 map 组件 id 一致
 */
function registerMapContext(mapId) {
  if (mapId) {
    mapContext = wx.createMapContext(mapId);
  }
}

function isDevToolsEnv() {
  try {
    return wx.getSystemInfoSync().platform === "devtools";
  } catch (e) {
    return false;
  }
}

function getFarmerCoords(farmer) {
  return {
    lat: Number(farmer.lat != null ? farmer.lat : farmer.latitude),
    lng: Number(farmer.lng != null ? farmer.lng : farmer.longitude),
    name: farmer.name || "目的地",
  };
}

function showDevtoolsOnlyToast() {
  wx.showToast({
    title: DEVTOOLS_TOAST,
    icon: "none",
    duration: 2500,
  });
}

function tryOpenMapMiniProgram(mapKey, farmer) {
  const cfg = MAP_MINI_CONFIG[mapKey];
  const { lat, lng, name } = getFarmerCoords(farmer);
  const encodedName = encodeURIComponent(name);
  const path = cfg.buildPath(lat, lng, encodedName);

  wx.navigateToMiniProgram({
    appId: cfg.appId,
    path,
    envVersion: "release",
    fail(err) {
      console.error("[navigate] navigateToMiniProgram fail", cfg.label, err);
      wx.showToast({
        title: `无法打开${cfg.label}，请确认已在 app.json 授权跳转`,
        icon: "none",
        duration: 2500,
      });
    },
  });
}

/**
 * 真机：优先拉起本机地图 App（微信官方 API，类似「懂营地」）
 */
function tryOpenNativeMapApp(mapKey, farmer, onFail) {
  if (!mapContext || typeof mapContext.openMapApp !== "function") {
    onFail();
    return;
  }

  const { lat, lng, name } = getFarmerCoords(farmer);
  const prefer = MAP_APP_PREFER[mapKey];

  mapContext.openMapApp({
    latitude: lat,
    longitude: lng,
    destination: name,
    preferApplication: prefer,
    success() {},
    fail(err) {
      console.warn("[navigate] openMapApp fail, fallback miniProgram", prefer, err);
      onFail();
    },
  });
}

function openMapOnDevice(mapKey, farmer) {
  tryOpenNativeMapApp(mapKey, farmer, () => {
    tryOpenMapMiniProgram(mapKey, farmer);
  });
}

/**
 * 统一导航入口
 * @param {Object} farmer - 含 lat/lng/name
 */
function handleNavigateToFarmer(farmer) {
  if (!farmer) {
    wx.showToast({
      title: "无法获取农户位置",
      icon: "none",
    });
    return;
  }

  const { lat, lng } = getFarmerCoords(farmer);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    wx.showToast({
      title: "位置信息无效",
      icon: "none",
    });
    return;
  }

  wx.showActionSheet({
    itemList: ["腾讯地图", "高德地图", "百度地图"],
    success(res) {
      if (isDevToolsEnv()) {
        showDevtoolsOnlyToast();
        return;
      }

      const mapKey = MAP_KEYS[res.tapIndex];
      if (mapKey) {
        openMapOnDevice(mapKey, farmer);
      }
    },
  });
}

module.exports = {
  handleNavigateToFarmer,
  navigateToFarmer: handleNavigateToFarmer,
  registerMapContext,
  /** 供文档说明：三个地图小程序 AppId */
  MAP_APP_IDS: {
    tencent: TENCENT_MINI_APP_ID,
    amap: AMAP_MINI_APP_ID,
    baidu: BAIDU_MINI_APP_ID,
  },
};
