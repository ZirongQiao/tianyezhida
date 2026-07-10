const {
  handleNavigateToFarmer,
  registerMapContext,
} = require("../../utils/navigate");
const { getMapBubbleColor, getMerchantTheme } = require("../../utils/merchant");
const {
  getRegisteredMerchants,
  saveRegisteredMerchant,
  updateRegisteredMerchant,
} = require("../../utils/merchant-store");
const { listMerchants, getMyBoundMerchant } = require("../../utils/merchant-api");
const {
  resolveMerchantAvatarUrl,
  getMerchantAvatarInitial,
} = require("../../utils/avatar");
const { formatDistance } = require("../../utils/distance");

const DEFAULT_LAT = 30.67;
const DEFAULT_LNG = 104.08;

const MARKER_SIZE_DEFAULT = 32;
const MARKER_SIZE_SELECTED = 38;
const MARKER_SIZE_DIM = 28;
const MARKER_ANCHOR = { x: 0.5, y: 1 };

const CALLOUT_FONT_NORMAL = 14;
const CALLOUT_PAD_NORMAL = 6;
const CALLOUT_RADIUS_NORMAL = 8;
const CALLOUT_FONT_DIM = 12;
const CALLOUT_PAD_DIM = 4;
const CALLOUT_RADIUS_DIM = 6;

function getFarmerCategories(merchant) {
  return merchant.categories || merchant.products || merchant.goods || [];
}

function filterFarmers(merchants, selectedCategories) {
  if (!selectedCategories || selectedCategories.length === 0) {
    return merchants;
  }

  return merchants.filter((merchant) => {
    const merchantCategories = getFarmerCategories(merchant);
    return selectedCategories.some((category) =>
      merchantCategories.includes(category)
    );
  });
}

function getVisibleMerchants(farmers, selectedCategories) {
  return filterFarmers(farmers || [], selectedCategories);
}

function buildMarkers(merchants, selectedMarkerId) {
  const hasSelection = selectedMarkerId != null;

  return merchants.map((merchant) => {
    const isSelected = hasSelection && merchant.id === selectedMarkerId;

    let size = MARKER_SIZE_DEFAULT;
    let fontSize = CALLOUT_FONT_NORMAL;
    let padding = CALLOUT_PAD_NORMAL;
    let borderRadius = CALLOUT_RADIUS_NORMAL;

    if (isSelected) {
      size = MARKER_SIZE_SELECTED;
    } else if (hasSelection) {
      size = MARKER_SIZE_DIM;
      fontSize = CALLOUT_FONT_DIM;
      padding = CALLOUT_PAD_DIM;
      borderRadius = CALLOUT_RADIUS_DIM;
    }

    return {
      id: merchant.id,
      latitude: merchant.lat,
      longitude: merchant.lng,
      width: size,
      height: size,
      anchor: MARKER_ANCHOR,
      zIndex: isSelected ? 2 : 1,
      title: merchant.name,
      callout: {
        content: merchant.name,
        color: "#ffffff",
        fontSize,
        borderRadius,
        bgColor: getMapBubbleColor(merchant),
        padding,
        display: "ALWAYS",
        textAlign: "center",
      },
    };
  });
}

function toCardMerchant(merchant, userLat, userLng) {
  const theme = getMerchantTheme(merchant);
  return {
    id: merchant.id,
    name: merchant.name,
    lat: merchant.lat,
    lng: merchant.lng,
    categories: merchant.categories,
    merchantType: theme.type,
    typeLabel: theme.label,
    tagBg: theme.tagBg,
    tagColor: theme.tagColor,
    bubbleColor: theme.bubbleColor,
    avatarUrl: resolveMerchantAvatarUrl(merchant),
    avatarInitial: getMerchantAvatarInitial(merchant),
    distanceText: formatDistance(
      userLat,
      userLng,
      merchant.lat,
      merchant.lng
    ),
  };
}

Page({
  data: {
    latitude: DEFAULT_LAT,
    longitude: DEFAULT_LNG,
    scale: 8,
    markers: [],
    farmers: [],
    statusBarHeight: 0,
    categories: [
      { name: "鸡蛋", icon: "/images/categories/egg_chicken.png" },
      { name: "鸭蛋", icon: "/images/categories/egg_duck.png" },
      { name: "鹅蛋", icon: "/images/categories/egg_goose.png" },
      { name: "时令蔬菜", icon: "/images/categories/veg.png" },
      { name: "时令水果", icon: "/images/categories/fruit.png" },
      { name: "蜂蜜", icon: "/images/categories/honey.png" },
    ],
    selectedCategories: [],
    selectedFarmer: null,
    showCard: false,
    cardSlideIn: false,
    categoryExpanded: true,
    showContactModal: false,
    showLogoPreview: false,
    selectedMarkerId: null,
  },

  categoryTouchStartY: 0,

  onShow() {
    this.loadCloudMerchants();
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 0,
    });
    this.loadCloudMerchants();
    this.getUserLocation();
  },

  onReady() {
    registerMapContext("mainMap");
  },

  async loadCloudMerchants() {
    const farmers = await listMerchants();
    this.setData({ farmers }, () => {
      this.updateMarkers(this.data.selectedCategories);
    });
  },

  updateMarkers(selectedCategories) {
    const visibleMerchants = getVisibleMerchants(
      this.data.farmers,
      selectedCategories
    );
    this.setData({
      markers: buildMarkers(visibleMerchants, this.data.selectedMarkerId),
    });
  },

  getUserLocation() {
    wx.getLocation({
      type: "gcj02",
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
        });
      },
      fail: () => {
        wx.showToast({
          title: "定位失败，已显示默认区域",
          icon: "none",
        });
      },
    });
  },

  onCategoryTap(e) {
    const { category } = e.currentTarget.dataset;
    const selectedCategories = [...this.data.selectedCategories];
    const index = selectedCategories.indexOf(category);

    if (index >= 0) {
      selectedCategories.splice(index, 1);
    } else {
      selectedCategories.push(category);
    }

    this.setData({ selectedCategories });
    this.updateMarkers(selectedCategories);
  },

  onContactTap() {
    this.setData({ showContactModal: true });
  },

  onFabFarmerTap() {
    this.onFarmerTap();
  },

  applyBoundMerchantSession(merchant) {
    const app = getApp();
    const list = getRegisteredMerchants();
    const cloudId = merchant && merchant._id ? String(merchant._id) : "";
    let sessionMerchant = merchant;

    if (cloudId) {
      const existing = list.find((m) => String(m._id) === cloudId);
      if (existing) {
        sessionMerchant = updateRegisteredMerchant(merchant, existing.id) || {
          ...existing,
          ...merchant,
        };
      } else {
        saveRegisteredMerchant(merchant);
      }
    }

    if (app.globalData) {
      app.globalData.userRole = "farmer";
      app.globalData.isRegistered = true;
      app.globalData.currentMerchantId =
        sessionMerchant && sessionMerchant.id != null
          ? sessionMerchant.id
          : null;
    }
  },

  async onFarmerTap() {
    wx.showLoading({ title: "加载中", mask: true });

    try {
      const result = await getMyBoundMerchant();
      if (!result.success) {
        wx.showToast({ title: "网络异常，请重试", icon: "none" });
        return;
      }

      if (result.merchant) {
        this.applyBoundMerchantSession(result.merchant);
        wx.navigateTo({ url: "/pages/farmer/home/home" });
        return;
      }

      wx.navigateTo({ url: "/pages/register/step1/step1" });
    } catch (e) {
      console.warn("[map] onFarmerTap failed", e);
      wx.showToast({ title: "网络异常，请重试", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onFabContactTap() {
    this.onContactTap();
  },

  onLogoTap() {
    this.setData({ showLogoPreview: true });
  },

  closeLogoPreview() {
    this.setData({ showLogoPreview: false });
  },

  onCloseContact() {
    this.setData({ showContactModal: false });
  },

  onCallPhone() {
    wx.makePhoneCall({ phoneNumber: "17358512219" });
  },

  showMerchantCard(markerId) {
    const merchant = (this.data.farmers || []).find(
      (item) => item.id === markerId
    );
    if (!merchant) return;

    const visibleMerchants = getVisibleMerchants(
      this.data.farmers,
      this.data.selectedCategories
    );

    this.setData({
      selectedFarmer: toCardMerchant(
        merchant,
        this.data.latitude,
        this.data.longitude
      ),
      showCard: true,
      cardSlideIn: false,
      selectedMarkerId: markerId,
      markers: buildMarkers(visibleMerchants, markerId),
    });

    setTimeout(() => {
      this.setData({ cardSlideIn: true });
    }, 50);
  },

  onMarkerTap(e) {
    this.showMerchantCard(e.detail.markerId);
  },

  onCalloutTap(e) {
    this.showMerchantCard(e.detail.markerId);
  },

  onCloseCard() {
    const visibleMerchants = getVisibleMerchants(
      this.data.farmers,
      this.data.selectedCategories
    );
    this.setData({
      showCard: false,
      cardSlideIn: false,
      selectedFarmer: null,
      selectedMarkerId: null,
      markers: buildMarkers(visibleMerchants, null),
    });
  },

  onCardTap() {
    const { selectedFarmer } = this.data;
    if (!selectedFarmer) return;
    wx.navigateTo({
      url: `/pages/farmer-detail/farmer-detail?id=${selectedFarmer.id}`,
    });
  },

  onNavigate() {
    handleNavigateToFarmer(this.data.selectedFarmer);
  },

  onShareAppMessage() {
    const farmer = this.data.selectedFarmer;
    if (!farmer) {
      return {
        title: "田间直达",
        path: "/pages/map/map",
      };
    }
    const categories = farmer.categories || [];
    return {
      title: `${farmer.name} · ${categories.join("、")}`,
      path: `/pages/farmer-detail/farmer-detail?id=${farmer.id}`,
    };
  },

  onCollapseCategories() {
    this.setData({ categoryExpanded: false });
  },

  onExpandCategories() {
    this.setData({ categoryExpanded: true });
  },

  onCategoryTouchStart(e) {
    if (!e.touches || !e.touches.length) return;
    this.categoryTouchStartY = e.touches[0].clientY;
  },

  onCategoryTouchMove() {},

  onCategoryTouchEnd(e) {
    if (!e.changedTouches || !e.changedTouches.length) return;
    const deltaY = e.changedTouches[0].clientY - this.categoryTouchStartY;

    if (this.data.categoryExpanded && deltaY < -40) {
      this.setData({ categoryExpanded: false });
      return;
    }

    if (!this.data.categoryExpanded && deltaY > 40) {
      this.setData({ categoryExpanded: true });
    }
  },
});
