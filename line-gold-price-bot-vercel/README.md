# LINE Gold Price Bot บน Vercel

โปรเจกต์แยกสำหรับตอบราคาทองผ่าน LINE Messaging API ไม่ใช้ Firebase, Google Apps Script หรือ Google Sheets และไม่กระทบเว็บไซต์ Gold2Cash เดิม

## ติดตั้งแบบง่าย

1. สร้าง Repository ใหม่ใน GitHub ชื่อ `line-gold-price-bot`
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้เข้า Repository
3. เข้า Vercel แล้วเลือก **Add New → Project**
4. Import Repository `line-gold-price-bot`
5. ใน **Environment Variables** เพิ่มค่าต่อไปนี้:
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
   - `CRON_SECRET` (ต้องการเฉพาะเมื่อเปิดแจ้งเตือนอัตโนมัติ; ใช้อักษรสุ่มอย่างน้อย 32 ตัว)
6. กด **Deploy** โดยไม่ต้องแก้ Build Settings
7. เปิด `https://ชื่อโปรเจกต์.vercel.app/api/status` ต้องเห็น `"ok":true` และ `"configured":true`
8. นำ `https://ชื่อโปรเจกต์.vercel.app/api/webhook` ไปวางที่ LINE Developers → Messaging API → Webhook URL
9. กด **Verify** แล้วเปิด **Use webhook**
10. ใน LINE Official Account Manager ปิด Auto-reply เพื่อไม่ให้ตอบซ้ำ

## ทดสอบ

เพิ่มบัญชี LINE OA เป็นเพื่อน แล้วส่ง `ราคาทอง` บอตจะตอบ Flex Message ราคาทองคำแท่งและทองรูปพรรณ 96.5%

คำสั่งที่รองรับ: `ราคาทอง`, `ทองวันนี้`, `ทองคำวันนี้`, `ราคาล่าสุด`, `ล่าสุด`

## ความปลอดภัย

- ห้ามใส่ Token หรือ Secret ลงในซอร์สโค้ด
- Webhook ตรวจ `x-line-signature` ด้วย Channel Secret ทุกคำขอ
- `.env` และ `.env.local` ถูกกันออกจาก Git แล้ว
- ถ้า Token เคยปรากฏในภาพหรือแชต ให้ออก Token ใหม่ก่อนใช้งานจริง

## ตรวจโค้ดในเครื่อง (ไม่บังคับ)

```bash
npm install
npm test
npm run build
```

## เมื่อแก้ Environment Variables

หลังแก้ค่าใน Vercel ให้เปิดหน้า Deployments แล้ว Redeploy เวอร์ชันล่าสุด จากนั้นตรวจ `/api/status` อีกครั้ง

## แจ้งเตือนทุก 1 ชั่วโมง (ตัวเลือกเสริม)

Vercel Hobby เรียก Cron ภายในได้เพียงวันละครั้ง จึงใช้บริการตั้งเวลาภายนอก เช่น cron-job.org เรียก URL นี้:

```text
https://ชื่อโปรเจกต์.vercel.app/api/broadcast?key=ค่า_CRON_SECRET
```

ตั้ง Schedule เป็น **Every 1 hour** และ Method เป็น `GET` จากนั้นกดทดสอบ ต้องได้ `"ok":true` หากต้องการทุก 30 นาที ให้เปลี่ยน Schedule เป็น 30 minutes โดยไม่ต้องแก้โค้ด

คำเตือน: Broadcast จะส่งหาผู้ติดตามทุกคนทุกครั้งและนับรวมในโควตาข้อความ LINE OA แนะนำเริ่มต้นทุก 1 ชั่วโมงก่อน และอย่าเผยแพร่ URL ที่มี `CRON_SECRET`
