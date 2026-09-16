function checkNeramitSetup() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    spreadsheetId = '13mFTC2jrIdkhlAF-OxRZerEh5viKAkNapybR1FIJwoI';
    properties.setProperty('SPREADSHEET_ID', spreadsheetId);
  }
  const apiKey = properties.getProperty('OPENAI_API_KEY');
  if (!apiKey || !apiKey.trim()) throw new Error('ยังไม่พบ OPENAI_API_KEY ใน Script Properties');
  SpreadsheetApp.openById(spreadsheetId);
  setupNeramitV2();
  console.log('✅ Neramit พร้อมใช้งาน');
}

function setupNeramitV2() {
  const db = getDatabase_();
  if (!db.getSheetByName('SETTINGS')) db.insertSheet('SETTINGS');
  const settingsSheet = db.getSheetByName('SETTINGS');
  if (settingsSheet.getLastRow() === 0) settingsSheet.getRange(1,1,1,3).setValues([['key','value','type']]);

  const requiredBase = {
    DEVICES:['device_id_hash','created_at','last_seen_at','usage_date','daily_count','status','updated_at','user_deleted_all_at'],
    PROMPTS:['job_id','device_id_hash','created_at','updated_at','expires_at','status','user_deleted_at','source_mode','platform','language','variant_count','input_summary_json','title','prompt_1','prompt_2','prompt_3','input_tokens','output_tokens','total_tokens','openai_request_id','job_state','quota_date','quota_units','draft_id','reference_count','variant_labels_json','error_code','processing_started_at','processing_heartbeat_at'],
    DAILY_USAGE:['usage_date','total_jobs','total_tokens','updated_at'],
    ERROR_LOGS:['error_id','error_code','job_id','draft_id','reference_id','function_name','safe_message','http_status','created_at','resolved_at']
  };
  Object.keys(requiredBase).forEach(function(name){ ensureSheetWithHeaders_(name, requiredBase[name]); });
  ensureSheetWithHeaders_('DRAFTS',['draft_id','device_id_hash','source_mode','draft_json','draft_state','created_at','updated_at','expires_at']);
  ensureSheetWithHeaders_('CHAT_MESSAGES',['message_id','request_id','draft_id','device_id_hash','role','message_text','structured_patch_json','quick_replies_json','created_at']);
  ensureSheetWithHeaders_('REFERENCE_IMAGES',['reference_id','draft_id','device_id_hash','drive_file_id','original_name','mime_type','byte_size','analysis_json','selected_aspects_json','created_at','expires_at','deleted_at','status']);
  ensureSheetWithHeaders_('ADMIN_SESSIONS',['session_hash','created_at','last_seen_at','expires_at','status']);
  ensureSheetWithHeaders_('ADMIN_AUDIT_LOGS',['event_id','session_hash','action','target_type','target_id','before_json','after_json','created_at']);

  const defaults = [
    ['REFERENCE_RETENTION_DAYS',30,'NUMBER'],['MAX_REFERENCE_IMAGES',4,'NUMBER'],['MAX_REFERENCE_IMAGE_MB',5,'NUMBER'],
    ['DRAFT_RETENTION_DAYS',30,'NUMBER'],['ADMIN_SESSION_HOURS',8,'NUMBER'],['ADMIN_LOGIN_MAX_ATTEMPTS',5,'NUMBER'],['CHAT_MAX_MESSAGES',30,'NUMBER']
  ];
  const existing = settingsSheet.getLastRow()>1 ? settingsSheet.getRange(2,1,settingsSheet.getLastRow()-1,1).getValues().flat().map(String) : [];
  defaults.forEach(function(row){ if (existing.indexOf(row[0])<0) settingsSheet.appendRow(row); });
  setupQuota();
  ensureReferenceFolder_();
}

function ensureReferenceFolder_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('REFERENCE_FOLDER_ID');
  if (id) { try { DriveApp.getFolderById(id); return id; } catch (_) {} }
  const folder = DriveApp.createFolder('Neramit References');
  props.setProperty('REFERENCE_FOLDER_ID', folder.getId());
  return folder.getId();
}

function setAdminPasswordOnce() {
  const props = PropertiesService.getScriptProperties();
  const password = props.getProperty('ADMIN_PASSWORD_ONCE');
  if (!password || password.length < 8) throw new Error('ตั้ง ADMIN_PASSWORD_ONCE อย่างน้อย 8 ตัวอักษรก่อน');
  const salt = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('ADMIN_PASSWORD_SALT', salt);
  props.setProperty('ADMIN_PASSWORD_HASH', hashAdminSecret_(password, salt));
  props.deleteProperty('ADMIN_PASSWORD_ONCE');
  console.log('✅ ตั้งรหัสผ่าน Admin และลบ plaintext แล้ว');
}
