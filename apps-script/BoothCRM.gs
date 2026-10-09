/**
 * BoothCRM — เก็บลูกค้าหน้าบูธที่พนักงานส่งเข้า LINE OA ลงในชีตนี้
 *
 * LINE OA -> Supabase Edge Function booth-line (ตรวจลายเซ็น LINE + ให้ Claude แยกข้อมูล) -> Web App นี้ -> ชีต "ลูกค้า"
 *
 * ติดตั้ง (ครั้งเดียว):
 *   1. เปิดชีต BoothCRM -> ส่วนขยาย (Extensions) -> Apps Script -> ลบโค้ดเดิม แล้ววางไฟล์นี้ -> บันทึก
 *   2. ใส่ SECRET ด้านล่าง (ได้จากผู้ตั้งค่า booth-line — ต้องตรงกับ BOOTH_SHEET_SECRET ใน Supabase)
 *   3. ทำให้ใช้งานได้ (Deploy) -> การทำให้ใช้งานได้รายการใหม่ -> ประเภท: เว็บแอป
 *      เรียกใช้ในฐานะ: ฉัน (Me) · ผู้มีสิทธิ์เข้าถึง: ทุกคน (Anyone) -> อนุญาตสิทธิ์ -> คัดลอก URL ของเว็บแอป
 *   แก้โค้ดภายหลัง: Deploy -> จัดการการทำให้ใช้งานได้ -> แก้ไข (ดินสอ) -> เวอร์ชัน: เวอร์ชันใหม่ -> ทำให้ใช้งานได้ (URL เดิม)
 */
var SECRET = '__BOOTH_SHEET_SECRET__';
var VERSION = 2;

var LEADS = 'ลูกค้า';
var STAFF = 'พนักงาน';
var SURVEY_KEYS = ['type', 'hasProduct', 'refill', 'inquiry', 'promoWish', 'pastPromo', 'goodPromo'];
var HEAD = ['วันที่เวลา', 'รหัส', 'ผู้บันทึก', 'งาน', 'ชื่อ', 'เบอร์โทร', 'เจ้าของสาขา',
  'คอร์ปอเรท/แฟรนไชส์', 'มีสินค้าเอมโอชา', 'เติมสินค้าบ่อยไหม', 'มีคนมาถามไหม',
  'อยากให้ช่วยโปรโมต', 'โปรที่เคยทำ', 'โปรที่ได้ผลดี', 'สรุป', 'ข้อความที่ส่งมา', 'หมายเหตุ', 'LINE user'];
var COL = { created: 1, id: 2, staff: 3, event: 4, name: 5, phone: 6, branch: 7, survey: 8, summary: 15, raw: 16, note: 17, uid: 18 };
var STAFF_HEAD = ['LINE user', 'ชื่อใน LINE', 'งานปัจจุบัน', 'อัปเดตล่าสุด'];
var LATEST_SCAN_ROWS = 300;

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ success: false, error: 'ข้อมูลไม่ถูกต้อง' }); }
  if (!SECRET || SECRET.indexOf('__') === 0 || req.secret !== SECRET) return out_({ success: false, error: 'ไม่อนุญาต' });
  // Only update/delete find a row by number and must not interleave; appends and staff upserts run freely,
  // so one slow Google call can't hold every other message up.
  var lock = (req.action === 'update' || req.action === 'delete') ? LockService.getScriptLock() : null;
  try {
    if (lock && !lock.tryLock(15000)) return out_({ success: false, error: 'ชีตกำลังยุ่ง ลองใหม่อีกครั้ง' });
    setup_();
    var r;
    switch (req.action) {
      case 'append': r = append_(req.lead || {}, req.staff); break;
      case 'update': r = update_(String(req.id || ''), req.lead || {}); break;
      case 'latest': r = latest_(String(req.lineUserId || ''), Number(req.withinMinutes) || 120); break;
      case 'delete': r = remove_(String(req.id || ''), String(req.lineUserId || '')); break;
      case 'staff': r = staff_(String(req.lineUserId || ''), req.displayName, req.event); break;
      case 'ping': r = { url: SpreadsheetApp.getActive().getUrl(), version: VERSION }; break;
      default: return out_({ success: false, error: 'ไม่รู้จักคำสั่ง' });
    }
    return out_({ success: true, result: r });
  } catch (err) {
    return out_({ success: false, error: String(err) });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function doGet() { return out_({ success: true, app: 'BoothCRM' }); }

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Creates the two tabs with headers the first time; plain-text cells keep phone numbers' leading 0.
function setup_() {
  var ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(LEADS)) {
    var first = ss.getSheets()[0];
    var sh = (ss.getSheets().length === 1 && first.getLastRow() === 0) ? first.setName(LEADS) : ss.insertSheet(LEADS);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#e8f5e9');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, sh.getMaxRows() - 1, HEAD.length).setNumberFormat('@');
    sh.getRange(2, COL.created, sh.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm');
    sh.setColumnWidths(1, HEAD.length, 130);
    sh.setColumnWidth(COL.summary, 280);
    sh.setColumnWidth(COL.raw, 360);
  }
  if (!ss.getSheetByName(STAFF)) {
    var st = ss.insertSheet(STAFF);
    st.getRange(1, 1, 1, STAFF_HEAD.length).setValues([STAFF_HEAD]).setFontWeight('bold').setBackground('#e8f5e9');
    st.setFrozenRows(1);
    st.getRange(2, 1, st.getMaxRows() - 1, STAFF_HEAD.length).setNumberFormat('@');
  }
}

function leadsSheet_() { return SpreadsheetApp.getActive().getSheetByName(LEADS); }

function rowValues_(lead, id, created) {
  var s = lead.survey || {};
  return [created, id, lead.staffName || '', lead.event || '', lead.name || '', lead.phone || '', lead.branch || '']
    .concat(SURVEY_KEYS.map(function (k) { return s[k] || ''; }))
    .concat([lead.summary || '', lead.rawText || '', lead.note || '', lead.lineUserId || '']);
}

function toLead_(v, row) {
  var survey = {};
  SURVEY_KEYS.forEach(function (k, i) { survey[k] = String(v[COL.survey - 1 + i] || ''); });
  return {
    row: row, id: String(v[COL.id - 1]), created: v[COL.created - 1] instanceof Date ? v[COL.created - 1].toISOString() : String(v[COL.created - 1]),
    staffName: String(v[COL.staff - 1]), event: String(v[COL.event - 1]), name: String(v[COL.name - 1]),
    phone: String(v[COL.phone - 1]), branch: String(v[COL.branch - 1]), survey: survey,
    summary: String(v[COL.summary - 1]), rawText: String(v[COL.raw - 1]), note: String(v[COL.note - 1]),
    lineUserId: String(v[COL.uid - 1]),
  };
}

function findRow_(id) {
  if (!id) return 0;
  var sh = leadsSheet_();
  var hit = sh.getRange(2, COL.id, Math.max(1, sh.getLastRow() - 1), 1).createTextFinder(id).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

// With `staff` ({ lineUserId, displayName }) the staff tab is updated in the same call, and the row takes
// the staff member's name and current event from it. appendRow is atomic, so parallel appends don't collide.
function append_(lead, staff) {
  if (staff && staff.lineUserId) {
    var s = staff_(String(staff.lineUserId), staff.displayName, null);
    lead.staffName = s.displayName || lead.staffName;
    lead.event = s.event;
  }
  var id = 'B' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
  var values = rowValues_(lead, id, new Date());
  leadsSheet_().appendRow(values);
  return toLead_(values, 0);
}

// Only the fields present in `lead` change; date, id, staff and LINE user stay.
function update_(id, lead) {
  var row = findRow_(id);
  if (!row) throw new Error('ไม่พบรายการ ' + id);
  var sh = leadsSheet_();
  var cur = toLead_(sh.getRange(row, 1, 1, HEAD.length).getValues()[0], row);
  ['name', 'phone', 'branch', 'summary', 'rawText', 'note'].forEach(function (k) { if (lead[k] !== undefined) cur[k] = lead[k]; });
  if (lead.survey) SURVEY_KEYS.forEach(function (k) { if (lead.survey[k] !== undefined) cur.survey[k] = lead.survey[k]; });
  var created = sh.getRange(row, COL.created).getValue();
  sh.getRange(row, 1, 1, HEAD.length).setValues([rowValues_(cur, cur.id, created)]);
  return toLead_(sh.getRange(row, 1, 1, HEAD.length).getValues()[0], row);
}

// The staff member's newest row, if it was created within the last `minutes`.
function latest_(uid, minutes) {
  if (!uid) return null;
  var sh = leadsSheet_(), last = sh.getLastRow();
  if (last < 2) return null;
  var start = Math.max(2, last - LATEST_SCAN_ROWS + 1);
  var values = sh.getRange(start, 1, last - start + 1, HEAD.length).getValues();
  var since = Date.now() - minutes * 60000;
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][COL.uid - 1]) !== uid) continue;
    var created = values[i][COL.created - 1];
    if (!(created instanceof Date) || created.getTime() < since) return null;
    return toLead_(values[i], start + i);
  }
  return null;
}

function remove_(id, uid) {
  var row = findRow_(id);
  if (!row) return false;
  var sh = leadsSheet_();
  if (String(sh.getRange(row, COL.uid).getValue()) !== uid) return false;
  sh.deleteRow(row);
  return true;
}

// Updates the LINE name when given; changes the event only when `event` is a string (null keeps it).
function staff_(uid, displayName, event) {
  var st = SpreadsheetApp.getActive().getSheetByName(STAFF);
  var hit = uid ? st.getRange(2, 1, Math.max(1, st.getLastRow() - 1), 1).createTextFinder(uid).matchEntireCell(true).findNext() : null;
  var cur = hit ? st.getRange(hit.getRow(), 1, 1, 4).getValues()[0] : [uid, '', '', ''];
  if (displayName) cur[1] = String(displayName);
  if (typeof event === 'string') cur[2] = event;
  cur[3] = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
  if (hit) st.getRange(hit.getRow(), 1, 1, 4).setValues([cur]);
  else st.appendRow(cur);
  return { lineUserId: uid, displayName: String(cur[1]), event: String(cur[2]) };
}
