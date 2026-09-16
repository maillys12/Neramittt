function createDraft(token, mode) {
  const deviceHash = authenticateDevice_(token);
  const sourceMode = String(mode || 'FORM').toUpperCase();
  if (!['FORM','CHAT'].includes(sourceMode)) throw new Error('โหมดดราฟต์ไม่ถูกต้อง');
  const settings = getSettings_();
  const now = new Date();
  const draftId = 'DRF-' + Utilities.getUuid();
  const brief = normalizeCreativeBrief_({});
  appendObjectRow_('DRAFTS', {
    draft_id:draftId, device_id_hash:deviceHash, source_mode:sourceMode,
    draft_json:JSON.stringify(brief), draft_state:'ACTIVE', created_at:now, updated_at:now,
    expires_at:new Date(now.getTime() + (settings.DRAFT_RETENTION_DAYS || 30) * 86400000)
  });
  return {draftId:draftId, sourceMode:sourceMode, brief:brief};
}

function getOwnedDraftRow_(deviceHash, draftId, allowSubmitted) {
  validateDraftId_(draftId);
  const table = table_('DRAFTS'); const c = table.columns;
  const index = table.rows.findIndex(function(row){
    return row[c.draft_id] === draftId && row[c.device_id_hash] === deviceHash;
  });
  if (index < 0) throw new Error('ไม่พบดราฟต์นี้');
  const row = table.rows[index];
  if (new Date(row[c.expires_at]).getTime() <= Date.now()) throw new Error('ดราฟต์นี้หมดอายุแล้ว');
  if (!allowSubmitted && row[c.draft_state] !== 'ACTIVE') throw new Error('ดราฟต์นี้ถูกส่งสร้างแล้ว');
  return {table:table,index:index,row:row};
}

function draftResponse_(owned) {
  const c = owned.table.columns; const row = owned.row;
  return {
    draftId:String(row[c.draft_id]), sourceMode:String(row[c.source_mode]),
    state:String(row[c.draft_state]), brief:normalizeCreativeBrief_(safeJsonParse_(row[c.draft_json],{})),
    updatedAt:new Date(row[c.updated_at]).toISOString()
  };
}

function getDraft(token, draftId) {
  const deviceHash = authenticateDevice_(token);
  return draftResponse_(getOwnedDraftRow_(deviceHash,draftId,true));
}

function updateDraft(token, draftId, patch) {
  const deviceHash = authenticateDevice_(token);
  return withQuotaLock_(function(){
    const owned = getOwnedDraftRow_(deviceHash,draftId,false);
    const c = owned.table.columns;
    const next = mergeCreativeBrief_(safeJsonParse_(owned.row[c.draft_json],{}), patch);
    const now = new Date();
    updateRowObject_('DRAFTS', owned.index, {draft_json:JSON.stringify(next),updated_at:now});
    owned.row[c.draft_json] = JSON.stringify(next); owned.row[c.updated_at] = now;
    return draftResponse_(owned);
  });
}

function setDraftState_(deviceHash,draftId,state) {
  const owned = getOwnedDraftRow_(deviceHash,draftId,true);
  updateRowObject_('DRAFTS',owned.index,{draft_state:state,updated_at:new Date()});
}

function getDraftReferenceSummaries_(deviceHash,draftId) {
  const table = table_('REFERENCE_IMAGES'); const c = table.columns;
  return table.rows.filter(function(row){
    return row[c.device_id_hash]===deviceHash && row[c.draft_id]===draftId && row[c.status]==='ACTIVE' && new Date(row[c.expires_at]).getTime()>Date.now();
  }).map(function(row){
    return {
      referenceId:String(row[c.reference_id]), name:String(row[c.original_name] || ''), mimeType:String(row[c.mime_type] || ''),
      analysis:safeJsonParse_(row[c.analysis_json],null), selectedAspects:safeJsonParse_(row[c.selected_aspects_json],[])
    };
  });
}

function getReview(token,draftId) {
  const deviceHash = authenticateDevice_(token);
  const draft = draftResponse_(getOwnedDraftRow_(deviceHash,draftId,true));
  return {draft:draft,references:getDraftReferenceSummaries_(deviceHash,draftId),quota:getDeviceQuotaStatus_(deviceHash)};
}
