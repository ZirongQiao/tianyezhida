function uploadLocalImage(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      reject(new Error("empty file path"));
      return;
    }
    if (!wx.cloud || !wx.cloud.uploadFile) {
      reject(new Error("cloud unavailable"));
      return;
    }
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (res) => resolve(res.fileID),
      fail: (err) => reject(err),
    });
  });
}

function isCloudFileId(path) {
  return String(path || "").startsWith("cloud://");
}

/**
 * 注册提交前：上传商户相册与头像，返回云 fileID
 * @param {{ photos: string[], avatar?: string, merchantCloudId: string }} payload - 本地临时路径
 * @returns {Promise<{ photoFileIds: string[], avatarFileId: string }>}
 */
async function uploadMerchantRegistrationMedia({ photos, avatar, merchantCloudId }) {
  const cloudId = String(merchantCloudId || "").trim();
  if (!cloudId) {
    throw new Error("missing merchantCloudId");
  }

  const base = `merchants/${cloudId}`;

  const photoFileIds = await Promise.all(
    photos.map((filePath, index) =>
      uploadLocalImage(filePath, `${base}/photos/${index}.jpg`)
    )
  );

  let avatarFileId;
  if (avatar) {
    avatarFileId = await uploadLocalImage(avatar, `${base}/avatar.jpg`);
  } else {
    avatarFileId = photoFileIds[0];
  }

  return { photoFileIds, avatarFileId };
}

/**
 * 农户主页：按需上传头像与相册（已是 cloud:// 则跳过）
 * @returns {Promise<{ avatarUrl: string, photos: string[] }>}
 */
async function uploadMerchantProfileMedia({ merchantId, avatarUrl, photos }) {
  const cloudId = String(merchantId || "").trim();
  if (!cloudId) {
    throw new Error("missing merchantId");
  }

  const base = `merchants/${cloudId}`;
  const timestamp = Date.now();
  const photoList = (photos || []).slice(0, 3);
  while (photoList.length < 3) {
    photoList.push("");
  }

  const uploadedPhotos = await Promise.all(
    photoList.map(async (path, index) => {
      if (!path) {
        return "";
      }
      if (isCloudFileId(path)) {
        return path;
      }
      return uploadLocalImage(path, `${base}/photos/${index}-${timestamp}.jpg`);
    })
  );

  let nextAvatar = avatarUrl || "";
  if (nextAvatar && !isCloudFileId(nextAvatar)) {
    nextAvatar = await uploadLocalImage(
      nextAvatar,
      `${base}/avatar-${timestamp}.jpg`
    );
  }

  return {
    avatarUrl: nextAvatar,
    photos: uploadedPhotos,
  };
}

module.exports = {
  uploadMerchantRegistrationMedia,
  uploadMerchantProfileMedia,
};
