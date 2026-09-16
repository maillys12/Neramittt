function getOpenAIKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!key || !key.trim()) throw new Error('ไม่พบ API Key');
  return key.trim();
}

function extractOpenAIText_(data) {
  return (data.output || []).filter(function(item){return item.type === 'message';})
    .flatMap(function(item){return item.content || [];})
    .filter(function(item){return item.type === 'output_text';})
    .map(function(item){return item.text;}).join('\n');
}

function callOpenAIStructured_(options) {
  const settings = getSettings_();
  const model = options.model || settings.OPENAI_MODEL;
  if (!model || model === 'TO_BE_CONFIGURED') throw new Error('กรุณาตั้งค่า OPENAI_MODEL');
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method:'post', contentType:'application/json', headers:{Authorization:'Bearer ' + getOpenAIKey_()},
    payload:JSON.stringify({
      model:model, store:false, max_output_tokens:options.maxOutputTokens || 5000,
      instructions:options.instructions || '', input:options.input,
      text:{format:{type:'json_schema',name:options.schemaName || 'neramit_result',strict:true,schema:options.schema}}
    }), muteHttpExceptions:true
  });
  const status = response.getResponseCode();
  let data; try { data = JSON.parse(response.getContentText()); } catch (_) { throw new Error('OpenAI ตอบกลับไม่ใช่ JSON'); }
  if (status < 200 || status >= 300) {
    const code = data && data.error && data.error.code ? String(data.error.code) : '';
    throw new Error('OpenAI HTTP ' + status + (code ? ' ('+code+')' : ''));
  }
  if (data.status !== 'completed') throw new Error('ผลลัพธ์ AI ยังไม่สมบูรณ์');
  let result; try { result = JSON.parse(extractOpenAIText_(data)); } catch (_) { throw new Error('AI ส่งข้อมูลไม่ตรงรูปแบบ'); }
  return {result:result, usage:data.usage || {}, response:response};
}

function testOpenAI() {
  const result = callOpenAIStructured_({
    instructions:'Return a short Thai status.', input:'Neramit status', schemaName:'neramit_test', maxOutputTokens:100,
    schema:{type:'object',properties:{message:{type:'string'}},required:['message'],additionalProperties:false}
  });
  console.log('✅ ' + result.result.message);
}
