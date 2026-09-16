// ใช้ล็อกเดียวกันทุกครั้งที่ตรวจและแก้โควตา
function withQuotaLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    return callback();
  } finally {
    try {
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  }
}

// อ่านข้อมูลตามชื่อคอลัมน์
function quotaTable_(name) {
  const sheet = getDatabase_().getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบชีต ' + name);

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const columns = Object.create(null);
  headers.forEach(function (header, index) {
    if (header) columns[String(header)] = index;
  });

  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(
        2, 1, sheet.getLastRow() - 1, headers.length
      ).getValues()
    : [];

  return { sheet, headers, columns, rows };
}

// รันฟังก์ชันนี้ครั้งแรกเพื่อติดตั้ง
// รันซ้ำได้ ไม่ลบข้อมูลเดิม
function setupQuota() {
  withQuotaLock_(function () {
    const table = quotaTable_('PROMPTS');
    const extra = [
      'job_state',
      'quota_date',
      'quota_units'
    ].filter(function (name) {
      return table.columns[name] === undefined;
    });

    if (extra.length) {
      const start = table.headers.length + 1;
      const needed = start + extra.length - 1;
      const sheet = table.sheet;

      if (needed > sheet.getMaxColumns()) {
        sheet.insertColumnsAfter(
          sheet.getMaxColumns(),
          needed - sheet.getMaxColumns()
        );
      }

      sheet.getRange(1, start, 1, extra.length)
        .setValues([extra]);
    }

    console.log('✅ เตรียมคอลัมน์โควตาเรียบร้อย');
  });

  const settings = getSettings_();
  console.log('ต่ออุปกรณ์: ' + settings.DEVICE_DAILY_LIMIT);
  console.log('รวมทั้งเว็บ: ' + settings.GLOBAL_DAILY_LIMIT);
  console.log('ขั้นติดตั้งนี้ไม่หักโควตาและไม่เรียก AI');
}

// เรียกภายในเซิร์ฟเวอร์หลังตรวจรหัสอุปกรณ์แล้ว
// requestId ต้องใช้ค่าเดิมเมื่อส่งคำขอเดิมซ้ำ
function reserveQuota_(deviceHash, requestId) {
  if (!/^[a-f0-9]{64}$/i.test(String(deviceHash))) {
    throw new Error('รหัสอุปกรณ์ไม่ถูกต้อง');
  }

  if (!/^[a-f0-9-]{36}$/i.test(String(requestId))) {
    throw new Error('รหัสคำขอไม่ถูกต้อง');
  }

  return withQuotaLock_(function () {
    const settings = getSettings_();

    if (
      settings.SYSTEM_ENABLED !== true ||
      settings.MAINTENANCE_MODE === true
    ) {
      throw new Error('ระบบปิดให้บริการชั่วคราว');
    }

    const devices = quotaTable_('DEVICES');
    const device = devices.rows.find(function (row) {
      return row[devices.columns.device_id_hash] === deviceHash;
    });

    if (!device || device[devices.columns.status] !== 'ACTIVE') {
      throw new Error('ไม่พบอุปกรณ์หรืออุปกรณ์ถูกระงับ');
    }

    const table = quotaTable_('PROMPTS');
    const c = table.columns;

    ['job_state', 'quota_date', 'quota_units'].forEach(function (key) {
      if (c[key] === undefined) {
        throw new Error('กรุณารัน setupQuota ก่อน');
      }
    });

    // ตรวจคำขอซ้ำก่อนจองเพิ่ม
    const jobId = 'PRM-' + requestId;
    const existing = table.rows.find(function (row) {
      return row[c.job_id] === jobId;
    });

    if (existing) {
      if (existing[c.device_id_hash] !== deviceHash) {
        throw new Error('รหัสคำขอถูกใช้แล้ว');
      }

      return {
        jobId: jobId,
        duplicate: true,
        state: existing[c.job_state]
      };
    }

    const now = new Date();
    const today = Utilities.formatDate(
      now, settings.TIMEZONE, 'yyyy-MM-dd'
    );

    let globalUsed = 0;
    let deviceUsed = 0;

    table.rows.forEach(function (row) {
      const date = row[c.quota_date] instanceof Date
        ? Utilities.formatDate(
            row[c.quota_date], settings.TIMEZONE, 'yyyy-MM-dd'
          )
        : String(row[c.quota_date]);

      if (date !== today || Number(row[c.quota_units]) !== 1) {
        return;
      }

      globalUsed++;
      if (row[c.device_id_hash] === deviceHash) deviceUsed++;
    });

    if (deviceUsed >= settings.DEVICE_DAILY_LIMIT) {
      throw new Error('โควตาของคุณวันนี้หมดแล้ว');
    }

    if (globalUsed >= settings.GLOBAL_DAILY_LIMIT) {
      throw new Error('โควตารวมของเว็บวันนี้เต็มแล้ว');
    }

    const row = Array(table.headers.length).fill('');
    row[c.job_id] = jobId;
    row[c.device_id_hash] = deviceHash;
    row[c.created_at] = now;
    row[c.updated_at] = now;

    // status = การแสดงประวัติ
    // job_state = สถานะประมวลผล
    row[c.status] = 'ACTIVE';
    row[c.job_state] = 'PROCESSING';
    row[c.quota_date] = today;
    row[c.quota_units] = 1;
    row[c.expires_at] = new Date(
      now.getTime() +
      settings.HISTORY_RETENTION_DAYS * 86400000
    );

    table.sheet.getRange(
      table.sheet.getLastRow() + 1,
      1, 1, row.length
    ).setValues([row]);

    return {
      jobId: jobId,
      duplicate: false,
      state: 'PROCESSING',
      remaining: settings.DEVICE_DAILY_LIMIT - deviceUsed - 1
    };
  });
}

// เรียกโดยเซิร์ฟเวอร์เท่านั้น
// สำเร็จ: เรียกหลังบันทึกพรอมต์ครบแล้ว
// ล้มเหลว: เรียกเมื่อยืนยันแล้วว่างานหยุดทำงาน
function finishQuota_(jobId, succeeded) {
  if (typeof succeeded !== 'boolean') {
    throw new Error('สถานะสำเร็จต้องเป็น boolean');
  }

  return withQuotaLock_(function () {
    const table = quotaTable_('PROMPTS');
    const c = table.columns;
    const index = table.rows.findIndex(function (row) {
      return row[c.job_id] === jobId;
    });

    if (index < 0) throw new Error('ไม่พบงาน');

    const row = table.rows[index];

    // ป้องกันการเปลี่ยนผลหรือคืนสิทธิ์ซ้ำ
    if (row[c.job_state] !== 'PROCESSING') {
      return { jobId: jobId, state: row[c.job_state] };
    }

    row[c.job_state] = succeeded ? 'SUCCEEDED' : 'FAILED';
    row[c.quota_units] = succeeded ? 1 : 0;
    row[c.updated_at] = new Date();

    table.sheet.getRange(
      index + 2, 1, 1, row.length
    ).setValues([row]);

    return { jobId: jobId, state: row[c.job_state] };
  });
}
