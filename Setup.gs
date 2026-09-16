function checkNeramitSetup() {
  const spreadsheetId =
    '13mFTC2jrIdkhlAF-OxRZerEh5viKAkNapybR1FIJwoI';

  const properties = PropertiesService.getScriptProperties();
  const apiKey = properties.getProperty('OPENAI_API_KEY');

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'ยังไม่พบ OPENAI_API_KEY ใน Script Properties'
    );
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

  const requiredSheets = [
    'SETTINGS',
    'DEVICES',
    'PROMPTS',
    'DAILY_USAGE',
    'ERROR_LOGS'
  ];

  const missingSheets = requiredSheets.filter(
    name => !spreadsheet.getSheetByName(name)
  );

  if (missingSheets.length > 0) {
    throw new Error(
      'ไม่พบชีต: ' + missingSheets.join(', ')
    );
  }

  // บันทึกเฉพาะ ID ฐานข้อมูล ไม่แก้ไข API Key
  properties.setProperty('SPREADSHEET_ID', spreadsheetId);

  console.log('✅ พบ API Key ในการตั้งค่า');
  console.log('✅ เชื่อมต่อฐานข้อมูล: ' + spreadsheet.getName());
  console.log('✅ พบชีตครบ 5 แท็บ');
  console.log('✅ บันทึก SPREADSHEET_ID แล้ว');
  console.log('ยังไม่ได้ทดสอบความถูกต้องของคีย์กับ OpenAI');
}
