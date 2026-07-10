const CONTACT_ERRORS = {
  MOBILE: "请输入正确的手机号",
  AREA: "请输入正确的区号",
  LANDLINE: "请输入正确的座机号码",
  EMPTY: "请至少填写一个有效联系电话",
};

const MASK_SUFFIX = "直达田间";

function digitsOnly(value) {
  return (value || "").replace(/\D/g, "");
}

const MOBILE_INPUT_MAX_LEN = 20;

function sanitizeMobileInput(value) {
  return String(value || "")
    .replace(/[^\d\s-]/g, "")
    .slice(0, MOBILE_INPUT_MAX_LEN);
}

function isValidMobileValue(value) {
  return /^1\d{10}$/.test(digitsOnly(value));
}

function isValidAreaValue(area) {
  return /^0\d{2,3}$/.test(digitsOnly(area));
}

function isValidLandlineNumberValue(number) {
  return /^\d{7,8}$/.test(digitsOnly(number));
}

function formatMobileDisplay(normalized) {
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 7)} ${normalized.slice(7, 11)}`;
}

function buildMobileContact(value) {
  const raw = (value || "").trim();
  const normalized = digitsOnly(raw);
  if (!/^1\d{10}$/.test(normalized)) {
    return null;
  }
  return {
    type: "mobile",
    raw,
    normalized,
    display: formatMobileDisplay(normalized),
  };
}

function buildLandlineContact(area, number) {
  const areaRaw = (area || "").trim();
  const numRaw = (number || "").trim();
  const areaNorm = digitsOnly(areaRaw);
  const numNorm = digitsOnly(numRaw);

  if (!/^0\d{2,3}$/.test(areaNorm) || !/^\d{7,8}$/.test(numNorm)) {
    return null;
  }

  return {
    type: "landline",
    raw: `${areaRaw}-${numRaw}`,
    normalized: `${areaNorm}${numNorm}`,
    display: `${areaNorm}-${numNorm}`,
  };
}

function rowHasMobileInput(row) {
  return !!(row.value && String(row.value).trim());
}

function rowHasLandlineInput(row) {
  return (
    !!(row.area && String(row.area).trim()) ||
    !!(row.number && String(row.number).trim())
  );
}

function createEmptyMobileRow(id) {
  return { id, value: "", error: "", invalid: false };
}

function createEmptyLandlineRow(id) {
  return {
    id,
    area: "",
    number: "",
    areaError: "",
    numberError: "",
    areaInvalid: false,
    numberInvalid: false,
  };
}

/**
 * 注册页：校验并仅收集有效 contacts；非法非空项标记 UI 但不入库
 */
function validateRegisterContacts(mobiles, landlines) {
  const nextMobiles = mobiles.map((row) => ({
    ...row,
    error: "",
    invalid: false,
  }));
  const nextLandlines = landlines.map((row) => ({
    ...row,
    areaError: "",
    numberError: "",
    areaInvalid: false,
    numberInvalid: false,
  }));

  const validContacts = [];
  let hasInvalidFilled = false;
  let hasAnyInput = false;

  nextMobiles.forEach((row, index) => {
    if (!rowHasMobileInput(row)) {
      return;
    }
    hasAnyInput = true;
    const contact = buildMobileContact(row.value);
    if (contact) {
      validContacts.push(contact);
    } else {
      nextMobiles[index].error = CONTACT_ERRORS.MOBILE;
      nextMobiles[index].invalid = true;
      hasInvalidFilled = true;
    }
  });

  nextLandlines.forEach((row, index) => {
    if (!rowHasLandlineInput(row)) {
      return;
    }
    hasAnyInput = true;

    const areaFilled = !!(row.area && String(row.area).trim());
    const numFilled = !!(row.number && String(row.number).trim());
    let rowInvalid = false;

    if (!areaFilled || !isValidAreaValue(row.area)) {
      nextLandlines[index].areaError = CONTACT_ERRORS.AREA;
      nextLandlines[index].areaInvalid = true;
      rowInvalid = true;
    }

    if (!numFilled || !isValidLandlineNumberValue(row.number)) {
      nextLandlines[index].numberError = CONTACT_ERRORS.LANDLINE;
      nextLandlines[index].numberInvalid = true;
      rowInvalid = true;
    }

    if (rowInvalid) {
      hasInvalidFilled = true;
      return;
    }

    const contact = buildLandlineContact(row.area, row.number);
    if (contact) {
      validContacts.push(contact);
    } else {
      nextLandlines[index].areaError = CONTACT_ERRORS.AREA;
      nextLandlines[index].numberError = CONTACT_ERRORS.LANDLINE;
      nextLandlines[index].areaInvalid = true;
      nextLandlines[index].numberInvalid = true;
      hasInvalidFilled = true;
    }
  });

  const canProceed = validContacts.length > 0;
  const allRejected = !canProceed;
  const needConfirm = canProceed && hasInvalidFilled;

  let contactsFormError = "";
  if (allRejected) {
    contactsFormError = CONTACT_ERRORS.EMPTY;
    if (!hasAnyInput) {
      nextMobiles.forEach((row, index) => {
        if (!rowHasMobileInput(row)) {
          nextMobiles[index].invalid = true;
        }
      });
      nextLandlines.forEach((row, index) => {
        if (!rowHasLandlineInput(row)) {
          nextLandlines[index].areaInvalid = true;
          nextLandlines[index].numberInvalid = true;
        }
      });
    }
  }

  return {
    canProceed,
    needConfirm,
    allRejected,
    hasInvalidFilled,
    contacts: validContacts,
    mobiles: nextMobiles,
    landlines: nextLandlines,
    contactsFormError,
  };
}

function validateSingleMobileRow(value) {
  if (!value || !String(value).trim()) {
    return { error: "", invalid: false };
  }
  if (isValidMobileValue(value)) {
    return { error: "", invalid: false };
  }
  return { error: CONTACT_ERRORS.MOBILE, invalid: true };
}

const CONFIRM_SKIP_INVALID_MSG =
  "部分联系电话格式不正确，将不会保存。是否继续？";

function validateSingleLandlineRow(area, number) {
  const hasInput = rowHasLandlineInput({ area, number });
  if (!hasInput) {
    return {
      areaError: "",
      numberError: "",
      areaInvalid: false,
      numberInvalid: false,
    };
  }

  const areaFilled = !!(area && String(area).trim());
  const numFilled = !!(number && String(number).trim());
  let areaError = "";
  let numberError = "";
  let areaInvalid = false;
  let numberInvalid = false;

  if (!areaFilled || !isValidAreaValue(area)) {
    areaError = CONTACT_ERRORS.AREA;
    areaInvalid = true;
  }
  if (!numFilled || !isValidLandlineNumberValue(number)) {
    numberError = CONTACT_ERRORS.LANDLINE;
    numberInvalid = true;
  }

  return { areaError, numberError, areaInvalid, numberInvalid };
}

function getValidContacts(contacts) {
  return (contacts || []).filter(
    (item) =>
      item &&
      item.normalized &&
      (item.type === "mobile" || item.type === "landline")
  );
}

function maskContactForPicker(contact) {
  if (contact.type === "mobile") {
    const n = contact.normalized;
    return `${n.slice(0, 3)} ${n.slice(3, 6)} ${MASK_SUFFIX}`;
  }

  const parts = (contact.display || "").split("-");
  const areaCode = parts[0] || contact.normalized.slice(0, 3);
  const localNum = parts[1] || contact.normalized.slice(areaCode.length);
  const visible = localNum.slice(0, 3);
  return `${areaCode} ${visible} ${MASK_SUFFIX}`;
}

function sortContactsForDial(contacts) {
  const valid = getValidContacts(contacts);
  const mobiles = valid.filter((c) => c.type === "mobile");
  const landlines = valid.filter((c) => c.type === "landline");
  return [...mobiles, ...landlines];
}

function dialMerchantContacts(contacts) {
  const ordered = sortContactsForDial(contacts);

  if (!ordered.length) {
    wx.showToast({
      title: "暂无可用联系电话",
      icon: "none",
    });
    return;
  }

  if (ordered.length === 1) {
    wx.makePhoneCall({
      phoneNumber: ordered[0].normalized,
    });
    return;
  }

  wx.showActionSheet({
    itemList: ordered.map(maskContactForPicker),
    success(res) {
      const picked = ordered[res.tapIndex];
      if (picked) {
        wx.makePhoneCall({
          phoneNumber: picked.normalized,
        });
      }
    },
  });
}

function legacyPhoneToContacts(phone) {
  if (!phone) {
    return [];
  }

  const clean = digitsOnly(phone);
  if (/^1\d{10}$/.test(clean)) {
    return [buildMobileContact(clean)];
  }

  const landlineMatch = clean.match(/^(0\d{2,3})(\d{7,8})$/);
  if (landlineMatch) {
    return [buildLandlineContact(landlineMatch[1], landlineMatch[2])];
  }

  if (clean.length >= 7) {
    return [
      {
        type: "landline",
        raw: phone,
        normalized: clean,
        display: phone,
      },
    ];
  }

  return [];
}

function getMerchantContacts(merchant) {
  if (merchant.contacts && merchant.contacts.length) {
    return merchant.contacts;
  }
  return legacyPhoneToContacts(merchant.phone);
}

function hasValidContacts(contacts) {
  return getValidContacts(contacts).length > 0;
}

module.exports = {
  CONTACT_ERRORS,
  CONFIRM_SKIP_INVALID_MSG,
  MOBILE_INPUT_MAX_LEN,
  sanitizeMobileInput,
  createEmptyMobileRow,
  createEmptyLandlineRow,
  validateRegisterContacts,
  validateSingleMobileRow,
  validateSingleLandlineRow,
  buildMobileContact,
  buildLandlineContact,
  getValidContacts,
  getMerchantContacts,
  hasValidContacts,
  dialMerchantContacts,
  maskContactForPicker,
};
