function testOpenAI() {
  const key = PropertiesService.getScriptProperties()
    .getProperty('OPENAI_API_KEY');

  if (!key || !key.trim()) {
    throw new Error('ไม่พบ OPENAI_API_KEY');
  }

  const response = UrlFetchApp.fetch(
    'https://api.openai.com/v1/responses',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + key.trim()
      },
      payload: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: 'ตอบสั้น ๆ ว่า เนรมิตพร้อมใช้งานแล้ว',
        max_output_tokens: 100,
        store: false
      }),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  let data;

  try {
    data = JSON.parse(response.getContentText());
  } catch (_) {
    throw new Error('ไม่ได้รับข้อมูล JSON จาก OpenAI: HTTP ' + status);
  }

  if (status < 200 || status >= 300) {
    const code = data.error && data.error.code;
    // ไม่พิมพ์ข้อความดิบจาก API เพื่อป้องกันคีย์หลุดใน log
    throw new Error(
      'OpenAI HTTP ' + status +
      (code ? ' (' + code + ')' : '')
    );
  }

  const text = (data.output || [])
    .filter(item => item.type === 'message')
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text)
    .join('\n');

  if (data.status !== 'completed' || !text.trim()) {
    throw new Error('ยังไม่ได้คำตอบสมบูรณ์: ' + data.status);
  }

  console.log('✅ เชื่อมต่อ OpenAI สำเร็จ');
  console.log(text);
  console.log('โทเคนที่ใช้: ' + (data.usage?.total_tokens ?? 'ไม่ระบุ'));
}
