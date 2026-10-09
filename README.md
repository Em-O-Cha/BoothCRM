# BoothCRM — บันทึกลูกค้าหน้าบูธ (Em-O-Cha)

หน้าเว็บสำหรับเก็บข้อมูลลูกค้าที่บูธด้วยเสียง: แตะบันทึกบทสนทนาครั้งเดียว คุยกับลูกค้าตามปกติ
ระบบดึงชื่อ เบอร์โทร สาขา และแบบสอบถาม 7 ข้อให้ตรวจก่อนบันทึก

- ใช้งาน: https://em-o-cha.github.io/BoothCRM/ (เปิดด้วย Google Chrome)
- ข้อมูลเก็บในเครื่องที่ใช้บันทึก ส่งออกเป็น CSV ได้จากแท็บ 📋 รายชื่อ
- ทั้งหน้าอยู่ในไฟล์เดียว `index.html`

## ส่งผ่าน LINE OA (เก็บลง Google Sheet)

พนักงานพิมพ์หรือกดไมค์บนคีย์บอร์ดพูดสรุปลูกค้า แล้วส่งเข้า LINE OA ของบูธ
Supabase Edge Function `booth-line` (repo Em-O-Cha/Order) ตรวจลายเซ็น LINE ให้ Claude แยกข้อมูล
แล้วเขียนลง Google Sheet ผ่าน Apps Script ใน `apps-script/BoothCRM.gs` — Supabase ไม่เก็บข้อมูลลูกค้า

คำสั่งในแชท: ข้อความทั่วไป = ลูกค้าใหม่ · `+ ข้อความ` = เพิ่มให้คนล่าสุด · `ลบ` · `ล่าสุด` · `งาน: ชื่องาน` · `ชีต` · `วิธีใช้`

ตั้งค่า: วาง `apps-script/BoothCRM.gs` ในชีต (ใส่ SECRET) แล้ว Deploy เป็นเว็บแอป (Execute as: Me, Access: Anyone)
แล้วตั้ง secrets ของ Supabase: `BOOTH_LINE_CHANNEL_SECRET`, `BOOTH_LINE_ACCESS_TOKEN`, `BOOTH_SHEET_URL`, `BOOTH_SHEET_SECRET`
Webhook URL ของ LINE: `https://qotlepudmkuniyjvqmle.supabase.co/functions/v1/booth-line`
