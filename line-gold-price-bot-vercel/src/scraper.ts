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

function normalizeDate(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTime(value: string): string {
  return value.replace(".", ":").padStart(5, "0");
}

export function createAnnouncementSignature(
  announcedDate: string,
  round: number,
  barBuy: number,
  barSell: number,
): string {
  return `${normalizeDate(announcedDate)}|${round}|${barBuy}|${barSell}`;
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

  const dateMatch = text.match(/ประจำวันที่\s*(?:วันที่\s*)?([0-3]?\d(?:\s+|\/|-)[^()]{1,45}?\d{4})\s*(?=เวลา|ณ เวลา|\(|ครั้งที่)/);
  const timeMatch = text.match(/(?:ณ\s*)?เวลา\s*([0-2]?\d[:.]\d{2})\s*น?\.?/);
  const roundMatch = text.match(/ครั้งที่\s*(\d+)/);

  if (!dateMatch || !timeMatch || !roundMatch) {
    throw new Error("ไม่พบวันที่ เวลา หรือครั้งที่ประกาศจากเว็บไซต์ต้นทาง");
  }

  const announcedDate = normalizeDate(dateMatch[1]);
  const announcedTime = normalizeTime(timeMatch[1]);
  const round = Number(roundMatch[1]);
  const signature = createAnnouncementSignature(announcedDate, round, barBuy!, barSell!);

  return {
    barBuy: barBuy!,
    barSell: barSell!,
    ornamentBase: ornamentBase!,
    ornamentSell: ornamentSell!,
    announcedDate,
    announcedTime,
    announcedAt: `${announcedDate} ${announcedTime} น.`,
    round,
    signature,
    sourceUrl: SOURCE_URL,
    fetchedAt: now.toISOString(),
  };
}

export async function fetchGoldPrice(): Promise<GoldPrice> {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "GoldPriceLineBot/2.0",
      "accept-language": "th-TH,th;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`เว็บไซต์ราคาทองตอบกลับ HTTP ${response.status}`);
  return parseGoldPriceHtml(await response.text());
}
