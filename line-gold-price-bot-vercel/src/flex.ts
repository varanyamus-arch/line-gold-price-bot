import type { messagingApi } from "@line/bot-sdk";
import type { GoldPrice } from "./types.js";

const baht = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);

function priceRow(label: string, buyLabel: string, buy: number, sell: number) {
  return {
    type: "box" as const, layout: "vertical" as const, spacing: "sm" as const,
    contents: [
      { type: "text" as const, text: label, weight: "bold" as const, color: "#4A3500", size: "md" as const },
      { type: "box" as const, layout: "horizontal" as const, margin: "md" as const, contents: [
        { type: "text" as const, text: buyLabel, color: "#777777", size: "sm" as const, flex: 3 },
        { type: "text" as const, text: baht(buy), weight: "bold" as const, color: "#16803C", align: "end" as const, flex: 2 },
      ] },
      { type: "box" as const, layout: "horizontal" as const, margin: "sm" as const, contents: [
        { type: "text" as const, text: "ขายออก", color: "#777777", size: "sm" as const, flex: 3 },
        { type: "text" as const, text: baht(sell), weight: "bold" as const, color: "#C3352B", align: "end" as const, flex: 2 },
      ] },
    ],
  };
}

export function goldPriceFlex(price: GoldPrice): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `ราคาทองคำแท่ง รับซื้อ ${baht(price.barBuy)} ขายออก ${baht(price.barSell)} บาท`,
    contents: {
      type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", backgroundColor: "#725500", paddingAll: "20px", contents: [
        { type: "text", text: "ราคาทองคำวันนี้", color: "#FFFFFF", weight: "bold", size: "xl" },
        { type: "text", text: price.announcedAt, color: "#F9E7A5", size: "xs", margin: "sm", wrap: true },
      ] },
      body: { type: "box", layout: "vertical", spacing: "xl", paddingAll: "20px", contents: [
        priceRow("ทองคำแท่ง 96.5%", "รับซื้อ", price.barBuy, price.barSell),
        { type: "separator" },
        priceRow("ทองรูปพรรณ 96.5%", "ฐานภาษี", price.ornamentBase, price.ornamentSell),
        { type: "text", text: price.round ? `ประกาศครั้งที่ ${price.round}` : "ประกาศล่าสุด", color: "#999999", size: "xs", align: "center", margin: "md" },
      ] },
      footer: { type: "box", layout: "vertical", contents: [
        { type: "button", style: "link", color: "#725500", action: { type: "uri", label: "ข้อมูลจากสมาคมค้าทองคำ", uri: price.sourceUrl } },
      ] },
    },
  };
}
