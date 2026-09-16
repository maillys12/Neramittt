function cleanupExpiredData() {
  const now = Date.now();
  const refs = table_('REFERENCE_IMAGES'); const c = refs.columns;
  let deleted = 0; let failed = 0;
  refs.rows.forEach(function(row,index){
    if (row[c.status] !== 'ACTIVE' || !row[c.expires_at] || new Date(row[c.expires_at]).getTime()>now) return;
    try {
      DriveApp.getFileById(String(row[c.drive_file_id])).setTrashed(true);
      updateRowObject_('REFERENCE_IMAGES',index,{status:'DELETED',deleted_at:new Date()}); deleted++;
    } catch (error) {
      failed++; logError_('REFERENCE_CLEANUP','',String(row[c.draft_id]||''),String(row[c.reference_id]||''),'cleanupExpiredData',error.message || String(error),'');
    }
  });
  reviewStuckPromptJobs_();
  return {deletedReferences:deleted,failedReferences:failed};
}

function installCleanupTrigger() {
  ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='cleanupExpiredData';}).forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger('cleanupExpiredData').timeBased().everyDays(1).atHour(3).create();
  console.log('✅ ติดตั้ง cleanup trigger แล้ว');
}

function reviewStuckPromptJobs_() {
  const table = table_('PROMPTS'); const c = table.columns; const cutoff = Date.now()-30*60*1000;
  table.rows.forEach(function(row,index){
    if (row[c.job_state] !== 'PROCESSING') return;
    const started = row[c.processing_started_at] || row[c.created_at];
    if (started && new Date(started).getTime() < cutoff) updateRowObject_('PROMPTS',index,{job_state:'NEEDS_REVIEW',error_code:'STALE_PROCESSING',updated_at:new Date()});
  });
}

function logError_(code,jobId,draftId,referenceId,functionName,message,httpStatus) {
  try { appendObjectRow_('ERROR_LOGS',{error_id:'ERR-'+Utilities.getUuid(),error_code:String(code||'UNKNOWN_ERROR'),job_id:String(jobId||''),draft_id:String(draftId||''),reference_id:String(referenceId||''),function_name:String(functionName||''),safe_message:cleanText_(message,800,'error'),http_status:String(httpStatus||''),created_at:new Date()}); } catch (_) {}
}
