# BoothCRM — บันทึกลูกค้าหน้าบูธ (Em-O-Cha)

หน้าเว็บสำหรับเก็บข้อมูลลูกค้าที่บูธ เลือกได้ 2 โหมด: 🎙️ บันทึกเสียง (คุยตามปกติ ระบบดึงข้อมูลให้) หรือ ✍️ กรอกเอง (แตะเลือกคำตอบ)
เก็บชื่อ เบอร์โทร สาขา และ "แสดงความคิดเห็น" 7 ข้อ — ทุกช่องไม่บังคับ

- ใช้งาน: https://em-o-cha.github.io/BoothCRM/ (เปิดด้วย Google Chrome)
- ข้อมูลเก็บในเครื่องที่ใช้บันทึก ส่งออกเป็น CSV ได้จากแท็บ 📋 รายชื่อ
- ทั้งหน้าอยู่ในไฟล์เดียว `index.html` (ใช้ `logo.png`, `qrcode.js` ร่วมกัน)

## ลูกค้าสแกน QR แสดงความคิดเห็นเอง

- หน้า: https://em-o-cha.github.io/BoothCRM/survey.html (`survey.html`) — ไม่ถามเบอร์โทร, แตะเลือกคำตอบ, ข้อ 5 เปลี่ยนตามคำตอบ "มี/ไม่มีสินค้า"
- ปุ่ม 📱 ในหน้าพนักงานแสดง QR ที่ติดชื่องานไปด้วย (`?e=ชื่องาน`) · โปสเตอร์พิมพ์: `qr-poster-a4.png`, QR เดี่ยว: `qr-survey.png`
- คำตอบส่งไป Supabase Edge Function `booth-survey` (repo Em-O-Cha/Order) แล้วลงชีต "ลูกค้า" โดยผู้บันทึก = `ลูกค้า (QR)`
- คำถามและตัวเลือกต้องตรงกันใน `survey.html`, `index.html` (SURVEY), `apps-script/BoothCRM.gs` (SURVEY_KEYS/HEAD) และ `_shared/booth_ai.ts` ใน Order

## ส่งผ่าน LINE OA (เก็บลง Google Sheet)

พนักงานพิมพ์หรือกดไมค์บนคีย์บอร์ดพูดสรุปลูกค้า แล้วส่งเข้า LINE OA ของบูธ
Supabase Edge Function `booth-line` (repo Em-O-Cha/Order) ตรวจลายเซ็น LINE ให้ Claude แยกข้อมูล
แล้วเขียนลง Google Sheet ผ่าน Apps Script ใน `apps-script/BoothCRM.gs` — Supabase ไม่เก็บข้อมูลลูกค้า

คำสั่งในแชท: ข้อความทั่วไป = ลูกค้าใหม่ · `+ ข้อความ` = เพิ่มให้คนล่าสุด · `ลบ` · `ล่าสุด` · `งาน: ชื่องาน` · `ชีต` · `วิธีใช้`

ตั้งค่า: วาง `apps-script/BoothCRM.gs` ในชีต (ใส่ SECRET) แล้ว Deploy เป็นเว็บแอป (Execute as: Me, Access: Anyone)
(ชีตเวอร์ชัน 3: คอลัมน์ "เหตุผลที่ไม่มีสินค้า" แทน "โปรที่เคยทำ" — เว็บแอปย้ายข้อมูลเดิมให้เองครั้งแรกที่ถูกเรียก)
แล้วตั้ง secrets ของ Supabase: `BOOTH_LINE_CHANNEL_SECRET`, `BOOTH_LINE_ACCESS_TOKEN`, `BOOTH_SHEET_URL`, `BOOTH_SHEET_SECRET`
Webhook URL ของ LINE: `https://qotlepudmkuniyjvqmle.supabase.co/functions/v1/booth-line`
