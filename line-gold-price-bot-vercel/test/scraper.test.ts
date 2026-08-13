import assert from "node:assert/strict";
import test from "node:test";
import { createAnnouncementSignature, parseGoldPriceHtml } from "../src/scraper.js";

test("แยกราคา วันที่ เวลา ครั้งที่ และ signature", () => {
  const html = `<body>ประจำวันที่ 10 สิงหาคม 2569 เวลา 16:31 น. (ครั้งที่ 20)
    ทองคำแท่ง 96.5% รับซื้อ 67,700.00 ขายออก 67,900.00
    ทองรูปพรรณ 96.5% ฐานภาษี 66,332.24 ขายออก 68,700.00 บาทละ</body>`;
  const price = parseGoldPriceHtml(html, new Date("2026-08-10T09:31:00Z"));
  assert.equal(price.barBuy, 67700);
  assert.equal(price.barSell, 67900);
  assert.equal(price.announcedDate, "10 สิงหาคม 2569");
  assert.equal(price.announcedTime, "16:31");
  assert.equal(price.round, 20);
  assert.equal(price.signature, "10 สิงหาคม 2569|20|67700|67900");
});

test("signature เปลี่ยนเมื่อครั้งที่เปลี่ยน แม้ราคาคงเดิม", () => {
  const first = createAnnouncementSignature("10 สิงหาคม 2569", 20, 67700, 67900);
  const second = createAnnouncementSignature("10 สิงหาคม 2569", 21, 67700, 67900);
  assert.notEqual(first, second);
});

test("หยุดเมื่อข้อมูลประกาศไม่ครบ", () => {
  assert.throws(() => parseGoldPriceHtml("<body>ไม่มีราคา</body>"), /ไม่พบราคาทองครบ 4 ช่อง/);
});
