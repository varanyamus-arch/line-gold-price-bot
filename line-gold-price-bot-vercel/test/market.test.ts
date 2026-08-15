import assert from "node:assert/strict";
import test from "node:test";
import { parseGoldSpotPayload, parseUsdThbPayload } from "../src/market.js";

test("อ่านราคาสปอร์ต XAU/USD", () => {
  assert.equal(parseGoldSpotPayload({ symbol: "XAU", price: 4376.16 }), 4376.16);
});

test("อ่านค่าเงินบาท USD/THB", () => {
  assert.equal(parseUsdThbPayload({ result: "success", base_code: "USD", rates: { THB: 33.16 } }), 33.16);
});

test("ปฏิเสธข้อมูลตลาดที่ไม่สมบูรณ์", () => {
  assert.throws(() => parseGoldSpotPayload({ price: 0 }), /Gold Spot/);
  assert.throws(() => parseUsdThbPayload({ result: "error" }), /USD\/THB/);
});
