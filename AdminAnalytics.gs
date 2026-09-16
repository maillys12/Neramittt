function getAdminDashboard(token) {
  authenticateAdminSession_(token); const settings=getSettings_(); const tz=settings.TIMEZONE; const now=new Date(); const today=Utilities.formatDate(now,tz,'yyyy-MM-dd');
  const prompts=table_('PROMPTS'); const pc=prompts.columns; let jobsToday=0,tokensToday=0,errorsToday=0; const byPlatform={}; const daily={};
  for(let i=6;i>=0;i--){const d=new Date(now.getTime()-i*86400000);daily[Utilities.formatDate(d,tz,'yyyy-MM-dd')]=0;}
  prompts.rows.forEach(function(row){const date=row[pc.created_at]?Utilities.formatDate(new Date(row[pc.created_at]),tz,'yyyy-MM-dd'):'';if(date===today){jobsToday++;tokensToday+=Number(row[pc.total_tokens]||0);const p=String(row[pc.platform]||'UNKNOWN');byPlatform[p]=(byPlatform[p]||0)+1;}if(Object.prototype.hasOwnProperty.call(daily,date))daily[date]++;});
  const errors=table_('ERROR_LOGS'); const ec=errors.columns; errors.rows.forEach(function(row){if(row[ec.created_at]&&Utilities.formatDate(new Date(row[ec.created_at]),tz,'yyyy-MM-dd')===today)errorsToday++;});
  const devices=table_('DEVICES'); const dc=devices.columns; const activeDevices=devices.rows.filter(function(row){return row[dc.status]==='ACTIVE'&&row[dc.last_seen_at]&&now-new Date(row[dc.last_seen_at])<7*86400000;}).length;
  const latest=listAdminJobs(token,1).items.slice(0,8);
  return {summary:{jobsToday:jobsToday,globalLimit:settings.GLOBAL_DAILY_LIMIT,activeDevices:activeDevices,tokensToday:tokensToday,errorsToday:errorsToday},daily:Object.keys(daily).map(function(date){return {date:date,count:daily[date]};}),platforms:Object.keys(byPlatform).map(function(name){return {name:name,count:byPlatform[name]};}),latestJobs:latest};
}
