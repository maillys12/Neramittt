// แปลงรหัสลับเป็น SHA-256 สำหรับค้นหาในฐานข้อมูล
function hashDeviceToken_(token) {
  if (
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    throw new Error('รหัสอุปกรณ์ไม่ถูกต้อง');
  }

  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    token,
    Utilities.Charset.UTF_8
  );

  return bytes.map(function (byte) {
    return ('0' + (byte & 255).toString(16)).slice(-2);
  }).join('');
}

// ลงทะเบียนอุปกรณ์ใหม่ ฝั่งเซิร์ฟเวอร์
function registerDevice_() {
  return withQuotaLock_(function () {
    const settings = getSettings_();

    if (
      settings.SYSTEM_ENABLED !== true ||
      settings.MAINTENANCE_MODE === true
    ) {
      throw new Error('ระบบปิดให้บริการชั่วคราว');
    }

    const table = quotaTable_('DEVICES');
    const c = table.columns;

    const token = (
      Utilities.getUuid() + Utilities.getUuid()
    ).replace(/-/g, '').toLowerCase();

    const hash = hashDeviceToken_(token);

    if (table.rows.some(function (row) {
      return row[c.device_id_hash] === hash;
    })) {
      throw new Error('สร้างรหัสอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่');
    }

    const now = new Date();
    const row = Array(table.headers.length).fill('');

    row[c.device_id_hash] = hash;
    row[c.created_at] = now;
    row[c.last_seen_at] = now;
    row[c.usage_date] = Utilities.formatDate(
      now, settings.TIMEZONE, 'yyyy-MM-dd'
    );
    row[c.daily_count] = 0;
    row[c.status] = 'ACTIVE';
    row[c.updated_at] = now;

    table.sheet.getRange(
      table.sheet.getLastRow() + 1,
      1, 1, row.length
    ).setValues([row]);

    // ส่งให้เบราว์เซอร์เก็บตอนเชื่อมหน้าเว็บ
    // ห้ามบันทึก token ลง log หรือชีต
    return { token: token };
  });
}

// ตรวจรหัสลับกับอุปกรณ์ที่ลงทะเบียนไว้
function authenticateDevice_(token) {
  const hash = hashDeviceToken_(token);

  return withQuotaLock_(function () {
    const table = quotaTable_('DEVICES');
    const c = table.columns;

    const index = table.rows.findIndex(function (row) {
      return row[c.device_id_hash] === hash;
    });

    if (index < 0) {
      throw new Error('ไม่พบอุปกรณ์ กรุณาลงทะเบียนใหม่');
    }

    const row = table.rows[index];

    if (row[c.status] !== 'ACTIVE') {
      throw new Error('อุปกรณ์นี้ถูกระงับการใช้งาน');
    }

    const now = new Date();

    table.sheet.getRange(
      index + 2, c.last_seen_at + 1
    ).setValue(now);

    return hash;
  });
}

// เชื่อมการตรวจอุปกรณ์เข้ากับระบบจองโควตา
function reserveDeviceJob_(token, requestId) {
  const deviceHash = authenticateDevice_(token);
  return reserveQuota_(deviceHash, requestId);
}

// ทดสอบด้วยอุปกรณ์ของผู้พัฒนา
// เก็บรหัสลับใน User Properties เพื่อรันซ้ำได้
function testDevices() {
  const properties = PropertiesService.getUserProperties();
  const propertyName = 'NERAMIT_TEST_DEVICE_TOKEN';
  let token = properties.getProperty(propertyName);

  if (!token) {
    token = registerDevice_().token;
    properties.setProperty(propertyName, token);
  }

  authenticateDevice_(token);

  console.log('✅ ลงทะเบียนและตรวจรหัสอุปกรณ์สำเร็จ');
  console.log('✅ ในชีตเก็บเฉพาะค่าแฮชของรหัสลับ');
  console.log('✅ พร้อมเชื่อมการจองโควตา');
  console.log('การทดสอบนี้ไม่หักโควตาและไม่เรียก OpenAI');
}
