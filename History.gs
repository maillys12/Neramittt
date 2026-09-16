function getHistory_(token, page, query, platform) {
  const deviceHash = authenticateDevice_(token); const pageNumber = Number(page||1);
  if (!Number.isInteger(pageNumber)||pageNumber<1) throw new Error('เลขหน้าไม่ถูกต้อง');
  query = String(query||'').trim().toLowerCase(); platform = String(platform||'').trim();
  return withQuotaLock_(function(){
    const table=quotaTable_('PROMPTS'); const c=table.columns; const now=Date.now(); const pageSize=12;
    const rows=table.rows.filter(function(row){
      if (row[c.device_id_hash]!==deviceHash||row[c.status]!=='ACTIVE'||row[c.job_state]!=='SUCCEEDED'||new Date(row[c.expires_at]).getTime()<=now) return false;
      if (platform && String(row[c.platform])!==platform) return false;
      if (query) {
        const hay=[row[c.title],row[c.prompt_1],row[c.prompt_2],row[c.prompt_3]].join(' ').toLowerCase();
        if (hay.indexOf(query)<0) return false;
      }
      return true;
    }).sort(function(a,b){return new Date(b[c.created_at])-new Date(a[c.created_at]);});
    const start=(pageNumber-1)*pageSize;
    return {page:pageNumber,pageSize:pageSize,total:rows.length,hasMore:start+pageSize<rows.length,items:rows.slice(start,start+pageSize).map(function(row){
      return {jobId:String(row[c.job_id]),title:String(row[c.title]||'พรอมต์ของฉัน'),createdAt:new Date(row[c.created_at]).toISOString(),platform:String(row[c.platform]),language:String(row[c.language]),variantCount:Number(row[c.variant_count]),sourceMode:String(row[c.source_mode]),draftId:c.draft_id!==undefined?String(row[c.draft_id]||''):''};
    })};
  });
}

function getHistoryDetail_(token, jobId) {
  const deviceHash=authenticateDevice_(token); validateHistoryJobId_(jobId);
  return withQuotaLock_(function(){
    const table=quotaTable_('PROMPTS'); const c=table.columns;
    const row=table.rows.find(function(r){return r[c.job_id]===jobId&&r[c.device_id_hash]===deviceHash&&r[c.status]==='ACTIVE'&&r[c.job_state]==='SUCCEEDED'&&new Date(r[c.expires_at]).getTime()>Date.now();});
    if(!row) throw new Error('ไม่พบประวัตินี้');
    const prompts=[row[c.prompt_1],row[c.prompt_2],row[c.prompt_3]].filter(Boolean).map(String);
    const labels=c.variant_labels_json!==undefined?safeJsonParse_(row[c.variant_labels_json],[]):[];
    return {jobId:String(row[c.job_id]),title:String(row[c.title]||''),createdAt:new Date(row[c.created_at]).toISOString(),platform:String(row[c.platform]),language:String(row[c.language]),sourceMode:String(row[c.source_mode]),prompts:prompts,variants:prompts.map(function(p,i){return {label:labels[i]||('แบบที่ '+(i+1)),prompt:p};}),input:safeJsonParse_(row[c.input_summary_json],{}),draftId:c.draft_id!==undefined?String(row[c.draft_id]||''):''};
  });
}

function cloneHistoryToDraft(token,jobId) {
  const detail=getHistoryDetail_(token,jobId); const source=detail.input||{}; let brief=source.brief||source;
  if (typeof brief === 'string') {
    const text = String(brief).trim();
    brief = {topic:text.split(/\n/)[0].slice(0,300),additional_details:text,aspect_ratio:'4:5'};
  }
  const created=createDraft(token,detail.sourceMode==='CHAT'?'CHAT':'FORM');
  updateDraft(token,created.draftId,brief&&typeof brief==='object'?brief:{});
  return getDraft(token,created.draftId);
}

function deleteHistoryJob_(token, jobId) {
  const deviceHash=authenticateDevice_(token); validateHistoryJobId_(jobId);
  return withQuotaLock_(function(){
    const table=quotaTable_('PROMPTS'); const c=table.columns; const index=table.rows.findIndex(function(row){return row[c.job_id]===jobId&&row[c.device_id_hash]===deviceHash;});
    if(index<0) throw new Error('ไม่พบประวัตินี้'); const row=table.rows[index];
    if(row[c.status]==='USER_DELETED') return {jobId:jobId,deleted:true};
    if(row[c.status]!=='ACTIVE'||row[c.job_state]!=='SUCCEEDED'||new Date(row[c.expires_at]).getTime()<=Date.now()) throw new Error('ไม่พบประวัติที่ลบได้');
    updateRowObject_('PROMPTS',index,{status:'USER_DELETED',user_deleted_at:new Date(),updated_at:new Date()}); return {jobId:jobId,deleted:true};
  });
}

function deleteAllHistory_(token) {
  const deviceHash=authenticateDevice_(token);
  return withQuotaLock_(function(){
    const table=quotaTable_('PROMPTS'); const c=table.columns; const now=new Date(); let count=0;
    table.rows.forEach(function(row,index){if(row[c.device_id_hash]===deviceHash&&row[c.status]==='ACTIVE'&&row[c.job_state]==='SUCCEEDED'&&new Date(row[c.expires_at]).getTime()>now.getTime()){updateRowObject_('PROMPTS',index,{status:'USER_DELETED',user_deleted_at:now,updated_at:now});count++;}});
    return {deletedCount:count};
  });
}

function validateHistoryJobId_(jobId){if(typeof jobId!=='string'||!/^PRM-[a-f0-9-]{36}$/i.test(jobId)) throw new Error('รหัสงานไม่ถูกต้อง');}
