function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Neramit | เนรมิต')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


// เปิดหน้าเว็บ: ลงทะเบียนอุปกรณ์ใหม่ หรือใช้รหัสเดิม
function initializeApp(token) {
  const settings = getSettings_();

  if (settings.SYSTEM_ENABLED !== true ||
      settings.MAINTENANCE_MODE === true) {
    throw new Error('เนรมิตกำลังปรับปรุงระบบ กรุณาลองใหม่ภายหลัง');
  }

  let deviceToken = token;

  if (!deviceToken) {
    deviceToken = registerDevice_().token;
  } else {
    authenticateDevice_(deviceToken);
  }

  return {
    token: deviceToken,
    platforms: settings.ACTIVE_PLATFORMS,
    defaultPlatform: settings.DEFAULT_PLATFORM,
    defaultLanguage: settings.DEFAULT_LANGUAGE,
    maxVariants: Math.min(3, settings.MAX_PROMPT_VARIANTS),
    deviceDailyLimit: settings.DEVICE_DAILY_LIMIT
  };
}


// รับคำขอสร้างพรอมต์จากหน้าเว็บ
function createPrompt(token, requestId, input) {
  if (!input || typeof input !== 'object' ||
      Array.isArray(input)) {
    throw new Error('ข้อมูลคำขอไม่ถูกต้อง');
  }

  return generatePrompts_(token, requestId, input);
}


// อ่านประวัติของอุปกรณ์นี้
function listMyHistory(token, page) {
  return getHistory_(token, page);
}


// เปิดรายละเอียดงาน
function openMyHistory(token, jobId) {
  return getHistoryDetail_(token, jobId);
}


// ซ่อนงานเดียว โดยเก็บข้อมูลหลังบ้านไว้
function removeMyHistory(token, jobId) {
  return deleteHistoryJob_(token, jobId);
}


// ซ่อนประวัติทั้งหมดของอุปกรณ์นี้
function removeAllMyHistory(token) {
  return deleteAllHistory_(token);
}
