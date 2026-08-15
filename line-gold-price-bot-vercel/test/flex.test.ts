import assert from "node:assert/strict";
import test from "node:test";
import { goldPriceFlex } from "../src/flex.js";
import type { GoldPriceNotification } from "../src/types.js";

test("Flex แสดงโลโก้โปร่งใสและรายละเอียดประกาศ", () => {
  const price: GoldPriceNotification = {
    barBuy: 67700,
    barSell: 67900,
    ornamentBase: 66332.24,
    ornamentSell: 68700,
    announcedDate: "10/08/2569",
    announcedTime: "16:31",
    announcedAt: "10/08/2569 16:31 น.",
    round: 20,
    signature: "10/08/2569|20|67700|67900",
    sourceUrl: "https://www.goldtraders.or.th/",
    fetchedAt: "2026-08-10T09:31:00.000Z",
    goldSpotUsd: 4376.16,
    usdThb: 33.16,
    marketFetchedAt: "2026-08-10T09:31:00.000Z",
  };

  const json = JSON.stringify(goldPriceFlex(price));

  assert.match(json, /kaewmanee-logo\.png/);
  assert.match(json, /ประกาศครั้งที่ 20 • 16:31 น\./);
  assert.match(json, /67,700/);
  assert.match(json, /67,900/);
  assert.match(json, /GOLD SPOT/);
  assert.match(json, /4,376\.16/);
  assert.match(json, /USD\/THB/);
  assert.match(json, /33\.16/);
});
