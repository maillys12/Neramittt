function cleanText_(value, max, label) {
  const text = String(value == null ? '' : value).trim();
  if (text.length > max) throw new Error((label || 'ข้อความ') + 'ยาวเกินกำหนด');
  return text;
}

function cleanList_(value, maxItems, maxChars, label) {
  if (value == null || value === '') return [];
  if (!Array.isArray(value)) value = [value];
  const seen = Object.create(null);
  return value.map(function (item) {
    return cleanText_(item, maxChars, label);
  }).filter(function (item) {
    if (!item || seen[item]) return false;
    seen[item] = true;
    return true;
  }).slice(0, maxItems);
}

function normalizeCreativeBrief_(input) {
  input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const topic = cleanText_(input.topic, 300, 'หัวข้อ');
  return {
    work_type: cleanText_(input.work_type, 160, 'ประเภทงาน'),
    topic: topic,
    poster_text: cleanText_(input.poster_text, 2500, 'ข้อความบนโปสเตอร์'),
    preserve_text: input.preserve_text !== false,
    style: cleanList_(input.style, 8, 80, 'สไตล์'),
    colors: cleanList_(input.colors, 8, 60, 'สี'),
    aspect_ratio: cleanText_(input.aspect_ratio, 40, 'สัดส่วน'),
    composition: cleanText_(input.composition, 600, 'การจัดวาง'),
    subjects: cleanList_(input.subjects, 12, 120, 'องค์ประกอบ'),
    additional_details: cleanText_(input.additional_details, 3500, 'รายละเอียดเพิ่มเติม')
  };
}

function sanitizeDraftPatch_(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('ข้อมูลแก้ไขดราฟต์ไม่ถูกต้อง');
  }
  const allowed = [
    'work_type','topic','poster_text','preserve_text','style','colors',
    'aspect_ratio','composition','subjects','additional_details'
  ];
  const out = {};
  allowed.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) return;
    if (key === 'preserve_text') out[key] = patch[key] !== false;
    else if (['style','colors','subjects'].includes(key)) {
      out[key] = cleanList_(patch[key], key === 'subjects' ? 12 : 8, 120, key);
    } else {
      const limits = {work_type:160, topic:300, poster_text:2500, aspect_ratio:40, composition:600, additional_details:3500};
      out[key] = cleanText_(patch[key], limits[key] || 300, key);
    }
  });
  return out;
}

function mergeCreativeBrief_(current, patch) {
  const base = normalizeCreativeBrief_(current || {});
  const safe = sanitizeDraftPatch_(patch || {});
  Object.keys(safe).forEach(function (key) { base[key] = safe[key]; });
  return normalizeCreativeBrief_(base);
}

function validateDraftId_(draftId) {
  if (!/^DRF-[a-f0-9-]{36}$/i.test(String(draftId || ''))) throw new Error('รหัสดราฟต์ไม่ถูกต้อง');
  return String(draftId);
}

function validateReferenceId_(referenceId) {
  if (!/^REF-[a-f0-9-]{36}$/i.test(String(referenceId || ''))) throw new Error('รหัสภาพอ้างอิงไม่ถูกต้อง');
  return String(referenceId);
}

function validateReferenceMime_(mime) {
  const value = String(mime || '').toLowerCase();
  if (!['image/jpeg','image/png','image/webp'].includes(value)) {
    throw new Error('รองรับเฉพาะไฟล์ภาพ JPEG, PNG และ WebP');
  }
  return value;
}

function safeJsonParse_(value, fallback) {
  try { return value ? JSON.parse(String(value)) : fallback; }
  catch (_) { return fallback; }
}
