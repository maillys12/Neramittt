function getDatabase_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function getSettings_() {
  const sheet = getDatabase_().getSheetByName('SETTINGS');
  if (!sheet || sheet.getLastRow() < 2) throw new Error('ไม่พบข้อมูลใน SETTINGS');
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  const settings = Object.create(null);
  rows.forEach(function (row) {
    const key = String(row[0]).trim();
    const type = String(row[2]).trim().toUpperCase();
    let value = row[1];
    if (!key) return;
    if (Object.prototype.hasOwnProperty.call(settings, key)) throw new Error('SETTINGS มีชื่อซ้ำ: ' + key);
    switch (type) {
      case 'NUMBER': value = Number(value); if (!Number.isFinite(value)) throw new Error('ค่าต้องเป็นตัวเลข: ' + key); break;
      case 'BOOLEAN': {
        const text = String(value).trim().toUpperCase();
        if (text !== 'TRUE' && text !== 'FALSE') throw new Error('ค่าต้องเป็น TRUE หรือ FALSE: ' + key);
        value = text === 'TRUE'; break;
      }
      case 'CSV': value = String(value).split(',').map(function (x) {return x.trim();}).filter(Boolean); break;
      case 'STRING': value = String(value).trim(); break;
      default: throw new Error('ชนิดข้อมูลไม่รองรับ: ' + key);
    }
    settings[key] = value;
  });
  ['DEVICE_DAILY_LIMIT','GLOBAL_DAILY_LIMIT','HISTORY_RETENTION_DAYS','MAX_REFERENCE_IMAGES','MAX_PROMPT_VARIANTS'].forEach(function (key) {
    if (!Number.isInteger(settings[key]) || settings[key] < 1) throw new Error(key + ' ต้องเป็นจำนวนเต็มมากกว่า 0');
  });
  return settings;
}

function ensureSheetWithHeaders_(name, headers) {
  const db = getDatabase_();
  let sheet = db.getSheetByName(name);
  if (!sheet) sheet = db.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  ensureColumns_(name, headers);
  return sheet;
}

function ensureColumns_(sheetName, names) {
  const sheet = getDatabase_().getSheetByName(sheetName);
  if (!sheet) throw new Error('ไม่พบชีต ' + sheetName);
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1,1,1,lastCol).getValues()[0].map(String);
  const missing = names.filter(function (name) { return headers.indexOf(name) < 0; });
  if (!missing.length) return;
  const start = headers.length + 1;
  const needed = start + missing.length - 1;
  if (needed > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns());
  sheet.getRange(1, start, 1, missing.length).setValues([missing]);
}

function table_(name) { return quotaTable_(name); }

function rowObject_(table, row) {
  const out = {};
  table.headers.forEach(function (h, i) { if (h) out[h] = row[i]; });
  return out;
}

function appendObjectRow_(name, obj) {
  const table = table_(name); const row = Array(table.headers.length).fill('');
  Object.keys(obj).forEach(function (key) {
    if (table.columns[key] === undefined) throw new Error('ไม่พบคอลัมน์ ' + key + ' ใน ' + name);
    let value = obj[key];
    if (typeof value === 'string' && /^\s*[=+\-@]/.test(value)) value = "'" + value;
    row[table.columns[key]] = value;
  });
  table.sheet.getRange(table.sheet.getLastRow()+1,1,1,row.length).setValues([row]);
  return row;
}

function updateRowObject_(name, index, changes) {
  const table = table_(name); const row = table.rows[index];
  if (!row) throw new Error('ไม่พบแถวข้อมูล');
  Object.keys(changes).forEach(function (key) {
    if (table.columns[key] === undefined) throw new Error('ไม่พบคอลัมน์ ' + key + ' ใน ' + name);
    let value = changes[key];
    if (typeof value === 'string' && /^\s*[=+\-@]/.test(value)) value = "'" + value;
    row[table.columns[key]] = value;
  });
  table.sheet.getRange(index+2,1,1,row.length).setValues([row]);
  return row;
}

function testDatabase() {
  const settings = getSettings_();
  if (!settings.OPENAI_MODEL || settings.OPENAI_MODEL === 'TO_BE_CONFIGURED') throw new Error('กรุณากำหนด OPENAI_MODEL ใน SETTINGS');
  if (!settings.TIMEZONE) throw new Error('ไม่พบ TIMEZONE ใน SETTINGS');
  console.log('✅ อ่านการตั้งค่าจากฐานข้อมูลสำเร็จ');
}
