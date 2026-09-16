function getHistory_(token, page) {
  const deviceHash = authenticateDevice_(token);
  const pageNumber = Number(page || 1);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error('เลขหน้าไม่ถูกต้อง');
  }

  return withQuotaLock_(() => {
    const table = quotaTable_('PROMPTS');
    const c = table.columns;
    const now = Date.now();
    const pageSize = 20;

    const rows = table.rows
      .filter(row =>
        row[c.device_id_hash] === deviceHash &&
        row[c.status] === 'ACTIVE' &&
        row[c.job_state] === 'SUCCEEDED' &&
        new Date(row[c.expires_at]).getTime() > now
      )
      .sort((a, b) =>
        new Date(b[c.created_at]).getTime() -
        new Date(a[c.created_at]).getTime()
      );

    const start = (pageNumber - 1) * pageSize;

    return {
      page: pageNumber,
      pageSize: pageSize,
      total: rows.length,
      hasMore: start + pageSize < rows.length,
      items: rows.slice(start, start + pageSize).map(row => ({
        jobId: String(row[c.job_id]),
        title: String(row[c.title] || 'พรอมต์ของฉัน'),
        createdAt: new Date(row[c.created_at]).toISOString(),
        platform: String(row[c.platform]),
        language: String(row[c.language]),
        variantCount: Number(row[c.variant_count]),
        sourceMode: String(row[c.source_mode])
      }))
    };
  });
}


function getHistoryDetail_(token, jobId) {
  const deviceHash = authenticateDevice_(token);
  validateHistoryJobId_(jobId);

  return withQuotaLock_(() => {
    const table = quotaTable_('PROMPTS');
    const c = table.columns;

    const row = table.rows.find(r =>
      r[c.job_id] === jobId &&
      r[c.device_id_hash] === deviceHash &&
      r[c.status] === 'ACTIVE' &&
      r[c.job_state] === 'SUCCEEDED' &&
      new Date(r[c.expires_at]).getTime() > Date.now()
    );

    if (!row) throw new Error('ไม่พบประวัตินี้');

    return {
      jobId: String(row[c.job_id]),
      title: String(row[c.title] || ''),
      createdAt: new Date(row[c.created_at]).toISOString(),
      platform: String(row[c.platform]),
      language: String(row[c.language]),
      sourceMode: String(row[c.source_mode]),
      prompts: [
        row[c.prompt_1],
        row[c.prompt_2],
        row[c.prompt_3]
      ].filter(Boolean).map(String)
    };
  });
}


function deleteHistoryJob_(token, jobId) {
  const deviceHash = authenticateDevice_(token);
  validateHistoryJobId_(jobId);

  return withQuotaLock_(() => {
    const table = quotaTable_('PROMPTS');
    const c = table.columns;

    const index = table.rows.findIndex(row =>
      row[c.job_id] === jobId &&
      row[c.device_id_hash] === deviceHash
    );

    if (index < 0) throw new Error('ไม่พบประวัตินี้');

    const row = table.rows[index];

    // กดลบซ้ำได้ โดยไม่เปลี่ยนข้อมูลเพิ่ม
    if (row[c.status] === 'USER_DELETED') {
      return { jobId: jobId, deleted: true };
    }

    if (row[c.status] !== 'ACTIVE' ||
        row[c.job_state] !== 'SUCCEEDED' ||
        new Date(row[c.expires_at]).getTime() <= Date.now()) {
      throw new Error('ไม่พบประวัติที่ลบได้');
    }

    const now = new Date();

    row[c.status] = 'USER_DELETED';
    row[c.user_deleted_at] = now;
    row[c.updated_at] = now;

    // เก็บข้อความพรอมต์และโควตาเดิมไว้
    table.sheet.getRange(
      index + 2, 1, 1, row.length
    ).setValues([row]);

    return { jobId: jobId, deleted: true };
  });
}


function deleteAllHistory_(token) {
  const deviceHash = authenticateDevice_(token);

  return withQuotaLock_(() => {
    const table = quotaTable_('PROMPTS');
    const c = table.columns;
    const now = new Date();
    let deletedCount = 0;

    table.rows.forEach((row, index) => {
      if (row[c.device_id_hash] !== deviceHash ||
          row[c.status] !== 'ACTIVE' ||
          row[c.job_state] !== 'SUCCEEDED' ||
          new Date(row[c.expires_at]).getTime() <= now.getTime()) {
        return;
      }

      row[c.status] = 'USER_DELETED';
      row[c.user_deleted_at] = now;
      row[c.updated_at] = now;

      table.sheet.getRange(
        index + 2, 1, 1, row.length
      ).setValues([row]);

      deletedCount++;
    });

    const devices = quotaTable_('DEVICES');
    const dc = devices.columns;
    const deviceIndex = devices.rows.findIndex(
      row => row[dc.device_id_hash] === deviceHash
    );

    if (deviceIndex >= 0) {
      devices.sheet.getRange(
        deviceIndex + 2, dc.user_deleted_all_at + 1
      ).setValue(now);

      devices.sheet.getRange(
        deviceIndex + 2, dc.updated_at + 1
      ).setValue(now);
    }

    return { deletedCount: deletedCount };
  });
}


function validateHistoryJobId_(jobId) {
  if (typeof jobId !== 'string' ||
      !/^PRM-[a-f0-9-]{36}$/i.test(jobId)) {
    throw new Error('รหัสงานไม่ถูกต้อง');
  }
}


function testHistory() {
  const token = PropertiesService.getUserProperties()
    .getProperty('NERAMIT_TEST_DEVICE_TOKEN');

  if (!token) throw new Error('กรุณารัน testDevices ก่อน');

  const history = getHistory_(token, 1);

  console.log('✅ อ่านประวัติสำเร็จ');
  console.log('จำนวนงานที่แสดงได้: ' + history.total);

  if (history.items.length) {
    const detail = getHistoryDetail_(
      token, history.items[0].jobId
    );

    console.log('งานล่าสุด: ' + detail.title);
    console.log('จำนวนพรอมต์: ' + detail.prompts.length);
  }

  console.log('การทดสอบนี้ไม่ลบข้อมูล ไม่เรียก AI และไม่ใช้โควตา');
}
