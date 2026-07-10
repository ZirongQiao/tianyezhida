const {
  resolveCurrentFarmerCloudId,
  listWantBuyMessages,
  markFarmerMessagesRead,
} = require("../../../utils/merchant-api");

function formatMessageTime(createdAtMs) {
  const ms = Number(createdAtMs) || 0;
  if (!ms) {
    return "";
  }
  const now = Date.now();
  const diff = now - ms;
  const date = new Date(ms);
  if (diff < 60000) {
    return "刚刚";
  }
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  }

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (isToday) {
    return `今天 ${hh}:${mm}`;
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) {
    return `昨天 ${hh}:${mm}`;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日 ${hh}:${mm}`;
}

function mapWantBuyRows(rows) {
  return (rows || []).map((row) => {
    const nickname = row.buyerNickName
      ? String(row.buyerNickName).trim()
      : "一位买家";
    const category = row.category || "";
    return {
      _id: row._id,
      title: `${nickname} 对你的 ${category} 感兴趣`,
      time: formatMessageTime(row.createdAtMs),
      createdAtMs: row.createdAtMs || 0,
    };
  });
}

Page({
  data: {
    statusBarHeight: 0,
    messages: [],
    empty: false,
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const app = getApp();
    if (app.globalData) {
      app.globalData.userRole = "farmer";
    }
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 0,
    });
  },

  onShow() {
    this.loadMessages();
  },

  async loadMessages() {
    const merchantCloudId = await resolveCurrentFarmerCloudId();
    if (!merchantCloudId) {
      this.setData({ messages: [], empty: true });
      return;
    }

    const rows = await listWantBuyMessages(merchantCloudId);
    const messages = mapWantBuyRows(rows);

    let readAt = Date.now();
    if (messages.length > 0) {
      readAt = Math.max(readAt, messages[0].createdAtMs || 0);
    }
    markFarmerMessagesRead(merchantCloudId, readAt);

    this.setData({
      messages,
      empty: messages.length === 0,
    });
  },

  onBack() {
    wx.navigateBack();
  },
});
