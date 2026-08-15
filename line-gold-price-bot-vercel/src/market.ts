import type { MarketSnapshot } from "./types.js";

export const GOLD_SPOT_URL = "https://api.gold-api.com/price/XAU";
export const USD_THB_URL = "https://open.er-api.com/v6/latest/USD";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function parseGoldSpotPayload(payload: unknown): number {
  if (!isRecord(payload) || payload.symbol !== "XAU") {
    throw new Error("ข้อมูล Gold Spot ไม่ถูกต้อง");
  }
  const price = positiveNumber(payload.price);
  if (price === null) throw new Error("ข้อมูล Gold Spot ไม่ถูกต้อง");
  return price;
}

export function parseUsdThbPayload(payload: unknown): number {
  if (!isRecord(payload) || payload.result !== "success" || payload.base_code !== "USD" || !isRecord(payload.rates)) {
    throw new Error("ข้อมูล USD/THB ไม่ถูกต้อง");
  }
  const rate = positiveNumber(payload.rates.THB);
  if (rate === null) throw new Error("ข้อมูล USD/THB ไม่ถูกต้อง");
  return rate;
}

async function fetchJson(url: string, label: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "user-agent": "KaewmaneeGoldLineBot/2.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${label} ตอบกลับ HTTP ${response.status}`);
  return response.json();
}

export async function fetchMarketSnapshot(now = new Date()): Promise<MarketSnapshot> {
  const [goldPayload, fxPayload] = await Promise.all([
    fetchJson(GOLD_SPOT_URL, "Gold API"),
    fetchJson(USD_THB_URL, "ExchangeRate-API"),
  ]);

  return {
    goldSpotUsd: parseGoldSpotPayload(goldPayload),
    usdThb: parseUsdThbPayload(fxPayload),
    marketFetchedAt: now.toISOString(),
  };
}
