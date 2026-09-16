function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Neramit | เนรมิต')
    .addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover');
}

function initializeApp(token, mode) {
  const settings = getSettings_();
  const adminOnly = String(mode || 'USER').toUpperCase() === 'ADMIN';
  if (!adminOnly && (settings.SYSTEM_ENABLED !== true || settings.MAINTENANCE_MODE === true)) throw new Error('เนรมิตกำลังปรับปรุงระบบ กรุณาลองใหม่ภายหลัง');
  let deviceToken = token || '';
  let quota = null;
  if (!adminOnly) {
    if (!deviceToken) deviceToken = registerDevice_().token; else authenticateDevice_(deviceToken);
    quota = getDeviceQuotaStatus_(hashDeviceToken_(deviceToken));
  }
  return {
    token: deviceToken,
    adminOnly: adminOnly,
    platforms: settings.ACTIVE_PLATFORMS,
    defaultPlatform: settings.DEFAULT_PLATFORM,
    defaultLanguage: settings.DEFAULT_LANGUAGE,
    maxVariants: Math.min(3, settings.MAX_PROMPT_VARIANTS),
    deviceDailyLimit: settings.DEVICE_DAILY_LIMIT,
    quota: quota,
    maxReferenceImages: Math.min(4, settings.MAX_REFERENCE_IMAGES || 4),
    maxReferenceImageMb: settings.MAX_REFERENCE_IMAGE_MB || 5,
    referenceRetentionDays: settings.REFERENCE_RETENTION_DAYS || 30
  };
}

function createPrompt(token, requestId, input) { return generatePrompts_(token, requestId, input); }
function listMyHistory(token, page, query, platform) { return getHistory_(token, page, query, platform); }
function openMyHistory(token, jobId) { return getHistoryDetail_(token, jobId); }
function removeMyHistory(token, jobId) { return deleteHistoryJob_(token, jobId); }
function removeAllMyHistory(token) { return deleteAllHistory_(token); }
