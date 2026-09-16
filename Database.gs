/**
 * เปิดฐานข้อมูล Neramit
 * ฟังก์ชันลงท้าย _ ใช้ภายในฝั่งเซิร์ฟเวอร์
 */
function getDatabase_() {
  const id = PropertiesService.getScriptProperties()
    .getProperty('SPREADSHEET_ID');

  if (!id) {
    throw new Error('ยังไม่ได้ตั้งค่า SPREADSHEET_ID');
  }

  return SpreadsheetApp.openById(id);
}

/**
 * อ่าน SETTINGS และแปลงชนิดข้อมูล
 */
function getSettings_() {
  const sheet = getDatabase_().getSheetByName('SETTINGS');

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('ไม่พบข้อมูลใน SETTINGS');
  }

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 3)
    .getValues();

  const settings = Object.create(null);

  rows.forEach(function (row) {
    const key = String(row[0]).trim();
    const type = String(row[2]).trim().toUpperCase();
    let value = row[1];

    if (!key) return;

    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      throw new Error('SETTINGS มีชื่อซ้ำ: ' + key);
    }

    switch (type) {
      case 'NUMBER':
        if (String(value).trim() === '') {
          throw new Error('ยังไม่ได้ระบุตัวเลข: ' + key);
        }
        value = Number(value);
        if (!Number.isFinite(value)) {
          throw new Error('ค่าต้องเป็นตัวเลข: ' + key);
        }
        break;

      case 'BOOLEAN':
        const text = String(value).trim().toUpperCase();
        if (text !== 'TRUE' && text !== 'FALSE') {
          throw new Error('ค่าต้องเป็น TRUE หรือ FALSE: ' + key);
        }
        value = text === 'TRUE';
        break;

      case 'CSV':
        value = String(value)
          .split(',')
          .map(function (item) { return item.trim(); })
          .filter(Boolean);
        break;

      case 'STRING':
        value = String(value).trim();
        break;

      default:
        throw new Error('ชนิดข้อมูลไม่รองรับ: ' + key);
    }

    settings[key] = value;
  });

  [
    'DEVICE_DAILY_LIMIT',
    'GLOBAL_DAILY_LIMIT',
    'HISTORY_RETENTION_DAYS',
    'MAX_REFERENCE_IMAGES',
    'MAX_PROMPT_VARIANTS'
  ].forEach(function (key) {
    if (!Number.isInteger(settings[key]) || settings[key] < 1) {
      throw new Error(key + ' ต้องเป็นจำนวนเต็มมากกว่า 0');
    }
  });

  return settings;
}

/**
 * เรียกจากตัวแก้ไขเพื่อตรวจการตั้งค่า
 * ไม่เรียก OpenAI และไม่นับโควตา
 */
function testDatabase() {
  const settings = getSettings_();

  if (
    !settings.OPENAI_MODEL ||
    settings.OPENAI_MODEL === 'TO_BE_CONFIGURED'
  ) {
    throw new Error('กรุณากำหนด OPENAI_MODEL ใน SETTINGS');
  }

  if (!settings.TIMEZONE) {
    throw new Error('ไม่พบ TIMEZONE ใน SETTINGS');
  }

  console.log('✅ อ่านการตั้งค่าจากฐานข้อมูลสำเร็จ');
  console.log('โมเดล: ' + settings.OPENAI_MODEL);
  console.log('โควตาต่ออุปกรณ์: ' + settings.DEVICE_DAILY_LIMIT);
  console.log('โควตารวม: ' + settings.GLOBAL_DAILY_LIMIT);
  console.log(
    'วันที่สำหรับนับโควตา: ' +
    Utilities.formatDate(new Date(), settings.TIMEZONE, 'yyyy-MM-dd')
  );
}
