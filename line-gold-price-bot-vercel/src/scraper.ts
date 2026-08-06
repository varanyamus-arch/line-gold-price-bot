import * as cheerio from "cheerio";
import type { GoldPrice } from "./types.js";

export const SOURCE_URL = "https://classic.goldtraders.or.th/default.aspx";

function parseNumber(text: string): number | null {
  const match = text.replace(/\u00a0/g, " ").match(/([0-9]{2,3}(?:,[0-9]{3})+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function findPrice(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseNumber(match[1] ?? match[0]);
      if (value !== null) return value;
    }
  }
  return null;
}

export function parseGoldPriceHtml(html: string, now = new Date()): GoldPrice {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const bar = text.match(/ทองคำแท่ง\s*96\.5%[\s\S]{0,300}/)?.[0] ?? text;
  const ornament = text.match(/ทองรูปพรรณ\s*96\.5%[\s\S]{0,300}/)?.[0] ?? text;

  const barBuy = findPrice(bar, [
    /ทองคำแท่ง\s*96\.5%[\s\S]{0,180}?รับซื้อ\s*([0-9,.]+)/,
    /รับซื้อ\s*([0-9,.]+)/,
  ]);
  const barSell = findPrice(bar, [
    /ทองคำแท่ง\s*96\.5%[\s\S]{0,180}?ขายออก\s*([0-9,.]+)/,
    /ขายออก\s*([0-9,.]+)/,
  ]);
  const ornamentBase = findPrice(ornament, [
    /ทองรูปพรรณ\s*96\.5%[\s\S]{0,180}?ฐานภาษี\s*([0-9,.]+)/,
    /ฐานภาษี\s*([0-9,.]+)/,
  ]);
  const ornamentSell = findPrice(ornament, [
    /ทองรูปพรรณ\s*96\.5%[\s\S]{0,180}?ขายออก\s*([0-9,.]+)/,
    /ขายออก\s*([0-9,.]+)/,
  ]);

  if ([barBuy, barSell, ornamentBase, ornamentSell].some((value) => value === null)) {
    throw new Error("ไม่พบราคาทองครบ 4 ช่อง อาจมีการเปลี่ยนรูปแบบเว็บไซต์ต้นทาง");
  }

  const announcedAt = text.match(/ประจำวันที่\s*([^()]{1,80}?)(?:\(ครั้งที่|บาทละ)/)?.[1]?.trim();
  const round = text.match(/ครั้งที่\s*(\d+)/)?.[1];
  return {
    barBuy: barBuy!, barSell: barSell!, ornamentBase: ornamentBase!, ornamentSell: ornamentSell!,
    announcedAt: announcedAt || new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
    }).format(now),
    round: round ? Number(round) : null,
    sourceUrl: SOURCE_URL,
    fetchedAt: now.toISOString(),
  };
}

export async function fetchGoldPrice(): Promise<GoldPrice> {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "GoldPriceLineBot/1.0",
      "accept-language": "th-TH,th;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`เว็บไซต์ราคาทองตอบกลับ HTTP ${response.status}`);
  return parseGoldPriceHtml(await response.text());
}
