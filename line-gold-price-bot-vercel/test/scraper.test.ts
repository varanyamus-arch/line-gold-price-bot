import assert from "node:assert/strict";
import test from "node:test";
import { parseGoldPriceHtml } from "../src/scraper.js";

test("แยกราคาทองครบสี่ช่อง", () => {
  const html = `<body>ประจำวันที่ 6 สิงหาคม 2569 (ครั้งที่ 34)
    ทองคำแท่ง 96.5% รับซื้อ 66,550.00 ขายออก 66,750.00
    ทองรูปพรรณ 96.5% ฐานภาษี 65,218.32 ขายออก 67,550.00 บาทละ</body>`;
  const price = parseGoldPriceHtml(html, new Date("2026-08-06T20:00:00Z"));
  assert.equal(price.barBuy, 66550);
  assert.equal(price.barSell, 66750);
  assert.equal(price.ornamentBase, 65218.32);
  assert.equal(price.ornamentSell, 67550);
  assert.equal(price.round, 34);
});

test("หยุดเมื่อข้อมูลราคาไม่ครบ", () => {
  assert.throws(() => parseGoldPriceHtml("<body>ไม่มีราคา</body>"), /ไม่พบราคาทองครบ 4 ช่อง/);
});
