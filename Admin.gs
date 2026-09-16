function hashAdminSecret_(secret, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt)+':'+String(secret), Utilities.Charset.UTF_8);
  return bytes.map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');
}

function adminLogin(password) {
  password = String(password || '');
  const settings = getSettings_(); const cache = CacheService.getScriptCache(); const key='admin_login_failures';
  const fails = Number(cache.get(key) || 0);
  if (fails >= (settings.ADMIN_LOGIN_MAX_ATTEMPTS || 5)) throw new Error('ลองรหัสผ่านผิดหลายครั้ง กรุณารอสักครู่');
  const props = PropertiesService.getScriptProperties(); const salt=props.getProperty('ADMIN_PASSWORD_SALT'); const expected=props.getProperty('ADMIN_PASSWORD_HASH');
  if (!salt || !expected) throw new Error('ยังไม่ได้ตั้งรหัสผ่าน Admin');
  if (hashAdminSecret_(password,salt) !== expected) {
    cache.put(key,String(fails+1),600); throw new Error('รหัสผ่านไม่ถูกต้อง');
  }
  cache.remove(key);
  const token=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'').toLowerCase(); const sessionHash=hashAdminSecret_(token,salt); const now=new Date();
  appendObjectRow_('ADMIN_SESSIONS',{session_hash:sessionHash,created_at:now,last_seen_at:now,expires_at:new Date(now.getTime()+(settings.ADMIN_SESSION_HOURS||8)*3600000),status:'ACTIVE'});
  appendAdminAudit_(sessionHash,'LOGIN','ADMIN','','','');
  return {token:token,expiresAt:new Date(now.getTime()+(settings.ADMIN_SESSION_HOURS||8)*3600000).toISOString()};
}

function authenticateAdminSession_(token) {
  const props=PropertiesService.getScriptProperties(); const salt=props.getProperty('ADMIN_PASSWORD_SALT');
  if (!salt || !token) throw new Error('กรุณาเข้าสู่ระบบ Admin');
  const hash=hashAdminSecret_(String(token),salt); const table=table_('ADMIN_SESSIONS'); const c=table.columns;
  const index=table.rows.findIndex(function(row){return row[c.session_hash]===hash;});
  if(index<0) throw new Error('Admin session ไม่ถูกต้อง'); const row=table.rows[index];
  if(row[c.status]!=='ACTIVE'||new Date(row[c.expires_at]).getTime()<=Date.now()) throw new Error('Admin session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  updateRowObject_('ADMIN_SESSIONS',index,{last_seen_at:new Date()}); return hash;
}

function adminLogout(token) {
  const hash=authenticateAdminSession_(token); const table=table_('ADMIN_SESSIONS'); const c=table.columns;
  const index=table.rows.findIndex(function(row){return row[c.session_hash]===hash;});
  if(index>=0) updateRowObject_('ADMIN_SESSIONS',index,{status:'REVOKED',last_seen_at:new Date()});
  appendAdminAudit_(hash,'LOGOUT','ADMIN','','',''); return {loggedOut:true};
}

function appendAdminAudit_(sessionHash,action,targetType,targetId,beforeValue,afterValue) {
  appendObjectRow_('ADMIN_AUDIT_LOGS',{event_id:'AUD-'+Utilities.getUuid(),session_hash:String(sessionHash||''),action:String(action),target_type:String(targetType||''),target_id:String(targetId||''),before_json:typeof beforeValue==='string'?beforeValue:JSON.stringify(beforeValue||''),after_json:typeof afterValue==='string'?afterValue:JSON.stringify(afterValue||''),created_at:new Date()});
}

function adminSettingsRows_() {
  const sheet = getDatabase_().getSheetByName('SETTINGS');
  if (!sheet || sheet.getLastRow() < 2) throw new Error('ไม่พบ SETTINGS');
  return {sheet:sheet,rows:sheet.getRange(2,1,sheet.getLastRow()-1,3).getValues()};
}

function getAdminSettings(token) {
  authenticateAdminSession_(token);
  const data=adminSettingsRows_();
  const safeKeys=['SYSTEM_ENABLED','MAINTENANCE_MODE','DEVICE_DAILY_LIMIT','GLOBAL_DAILY_LIMIT','HISTORY_RETENTION_DAYS','REFERENCE_RETENTION_DAYS','MAX_REFERENCE_IMAGES','MAX_REFERENCE_IMAGE_MB','MAX_PROMPT_VARIANTS','OPENAI_MODEL','ACTIVE_PLATFORMS','DEFAULT_PLATFORM','DEFAULT_LANGUAGE'];
  const out={}; data.rows.forEach(function(row){const key=String(row[0]||'').trim();if(safeKeys.includes(key))out[key]=row[1];}); return out;
}

function updateAdminSetting(token,key,value) {
  const sessionHash=authenticateAdminSession_(token); key=String(key||'');
  const allowed=['SYSTEM_ENABLED','MAINTENANCE_MODE','DEVICE_DAILY_LIMIT','GLOBAL_DAILY_LIMIT','HISTORY_RETENTION_DAYS','REFERENCE_RETENTION_DAYS','MAX_REFERENCE_IMAGES','MAX_REFERENCE_IMAGE_MB','MAX_PROMPT_VARIANTS','OPENAI_MODEL','ACTIVE_PLATFORMS','DEFAULT_PLATFORM','DEFAULT_LANGUAGE'];
  if(!allowed.includes(key)) throw new Error('ไม่อนุญาตให้แก้การตั้งค่านี้');
  const data=adminSettingsRows_(); const index=data.rows.findIndex(function(row){return String(row[0]).trim()===key;}); if(index<0) throw new Error('ไม่พบการตั้งค่า '+key);
  const before=data.rows[index][1]; let next=value; const type=String(data.rows[index][2]||'STRING').toUpperCase();
  if(type==='BOOLEAN') next=(value===true||String(value).toUpperCase()==='TRUE')?'TRUE':'FALSE';
  if(type==='NUMBER'){next=Number(value);if(!Number.isFinite(next)||next<1)throw new Error('ค่าต้องเป็นตัวเลขมากกว่า 0');}
  if(type==='CSV'&&Array.isArray(value)) next=value.join(',');
  data.sheet.getRange(index+2,2).setValue(next); appendAdminAudit_(sessionHash,'UPDATE_SETTING','SETTING',key,before,next);
  return {key:key,value:next};
}

function listAdminJobs(token,page) { authenticateAdminSession_(token); return adminListTable_('PROMPTS',page,20,function(table,row){const c=table.columns;return {jobId:String(row[c.job_id]),title:String(row[c.title]||''),state:String(row[c.job_state]||''),platform:String(row[c.platform]||''),sourceMode:String(row[c.source_mode]||''),tokens:Number(row[c.total_tokens]||0),createdAt:row[c.created_at]?new Date(row[c.created_at]).toISOString():''};}); }
function listAdminDevices(token,page) { authenticateAdminSession_(token); return adminListTable_('DEVICES',page,20,function(table,row){const c=table.columns;return {deviceHash:String(row[c.device_id_hash]||'').slice(0,12)+'…',fullHash:String(row[c.device_id_hash]||''),status:String(row[c.status]||''),lastSeenAt:row[c.last_seen_at]?new Date(row[c.last_seen_at]).toISOString():'',createdAt:row[c.created_at]?new Date(row[c.created_at]).toISOString():''};}); }
function listAdminErrors(token,page) { authenticateAdminSession_(token); return adminListTable_('ERROR_LOGS',page,30,function(table,row){const c=table.columns;return {errorId:String(row[c.error_id]||''),code:String(row[c.error_code]||''),message:String(row[c.safe_message]||''),functionName:String(row[c.function_name]||''),createdAt:row[c.created_at]?new Date(row[c.created_at]).toISOString():''};}); }
function listAdminReferences(token,page) { authenticateAdminSession_(token); return adminListTable_('REFERENCE_IMAGES',page,20,function(table,row){const c=table.columns;return {referenceId:String(row[c.reference_id]||''),name:String(row[c.original_name]||''),status:String(row[c.status]||''),byteSize:Number(row[c.byte_size]||0),expiresAt:row[c.expires_at]?new Date(row[c.expires_at]).toISOString():''};}); }

function adminListTable_(name,page,pageSize,mapper){page=Math.max(1,Number(page||1));const table=table_(name);const rows=table.rows.slice().reverse();const start=(page-1)*pageSize;return {page:page,total:rows.length,hasMore:start+pageSize<rows.length,items:rows.slice(start,start+pageSize).map(function(row){return mapper(table,row);})};}

function setDeviceStatus(token,deviceHash,status){const sessionHash=authenticateAdminSession_(token);status=String(status||'').toUpperCase();if(!['ACTIVE','SUSPENDED'].includes(status))throw new Error('สถานะอุปกรณ์ไม่ถูกต้อง');const table=table_('DEVICES');const c=table.columns;const index=table.rows.findIndex(function(row){return row[c.device_id_hash]===deviceHash;});if(index<0)throw new Error('ไม่พบอุปกรณ์');const before=table.rows[index][c.status];updateRowObject_('DEVICES',index,{status:status,updated_at:new Date()});appendAdminAudit_(sessionHash,'DEVICE_STATUS','DEVICE',deviceHash,before,status);return {status:status};}

function deleteAdminReference(token,referenceId){const sessionHash=authenticateAdminSession_(token);validateReferenceId_(referenceId);const table=table_('REFERENCE_IMAGES');const c=table.columns;const index=table.rows.findIndex(function(row){return row[c.reference_id]===referenceId;});if(index<0)throw new Error('ไม่พบภาพอ้างอิง');const before=rowObject_(table,table.rows[index]);try{DriveApp.getFileById(String(table.rows[index][c.drive_file_id])).setTrashed(true);}catch(_){}updateRowObject_('REFERENCE_IMAGES',index,{status:'DELETED',deleted_at:new Date()});appendAdminAudit_(sessionHash,'DELETE_REFERENCE','REFERENCE',referenceId,before,{status:'DELETED'});return {deleted:true};}
