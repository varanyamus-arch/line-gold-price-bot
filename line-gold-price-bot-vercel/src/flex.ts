import type { messagingApi } from "@line/bot-sdk";
import type { GoldPriceNotification } from "./types.js";

const baht = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
const market = (value: number) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value);
const logoUrl = "https://line-gold-price-bot-gamma.vercel.app/kaewmanee-logo.png";

export function goldPriceFlex(price: GoldPriceNotification): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: `ประกาศครั้งที่ ${price.round} เวลา ${price.announcedTime} น. ทองแท่งรับซื้อ ${baht(price.barBuy)} ขายออก ${baht(price.barSell)} บาท`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "horizontal",
        backgroundColor: "#2A1D20",
        paddingAll: "18px",
        contents: [
          {
            type: "box",
            layout: "vertical",
            flex: 3,
            justifyContent: "center",
            contents: [
              { type: "text", text: "ราคาทองคำวันนี้", color: "#F9E7A5", weight: "bold", size: "xl", wrap: true },
            ],
          },
          {
            type: "image",
            url: logoUrl,
            flex: 2,
            size: "full",
            aspectMode: "fit",
            aspectRatio: "1:1",
            gravity: "center",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "22px",
        contents: [
          { type: "text", text: "ทองคำแท่ง 96.5%", weight: "bold", color: "#4A3500", size: "lg" },
          {
            type: "box", layout: "horizontal", margin: "xl", contents: [
              { type: "text", text: "รับซื้อ", color: "#888888", size: "md", flex: 3 },
              { type: "text", text: baht(price.barBuy), weight: "bold", color: "#07883D", align: "end", size: "xl", flex: 3 },
            ],
          },
          {
            type: "box", layout: "horizontal", margin: "md", contents: [
              { type: "text", text: "ขายออก", color: "#888888", size: "md", flex: 3 },
              { type: "text", text: baht(price.barSell), weight: "bold", color: "#D22630", align: "end", size: "xl", flex: 3 },
            ],
          },
          { type: "separator", margin: "xxl" },
          {
            type: "box",
            layout: "horizontal",
            margin: "xl",
            contents: [
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                contents: [
                  { type: "text", text: "GOLD SPOT", weight: "bold", color: "#62430B", size: "sm" },
                  { type: "text", text: market(price.goldSpotUsd), weight: "bold", color: "#725500", size: "lg", margin: "sm" },
                  { type: "text", text: "ดอลลาร์/ออนซ์", color: "#8A7040", size: "xxs", margin: "xs" },
                ],
              },
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                contents: [
                  { type: "text", text: "USD/THB", weight: "bold", color: "#62430B", size: "sm", align: "end" },
                  { type: "text", text: market(price.usdThb), weight: "bold", color: "#725500", size: "lg", align: "end", margin: "sm" },
                  { type: "text", text: "บาท/ดอลลาร์", color: "#8A7040", size: "xxs", align: "end", margin: "xs" },
                ],
              },
            ],
          },
          { type: "separator", margin: "xxl" },
          {
            type: "text",
            text: `ประกาศครั้งที่ ${price.round} • ${price.announcedTime} น.`,
            weight: "bold",
            color: "#62430B",
            size: "md",
            align: "center",
            margin: "xxl",
          },
          { type: "text", text: `ประจำวันที่ ${price.announcedDate}`, color: "#725523", size: "sm", align: "center", margin: "lg" },
          { type: "text", text: "อ้างอิงข้อมูล: สมาคมค้าทองคำ", color: "#725523", size: "xs", align: "center", margin: "lg" },
          { type: "text", text: "ข้อมูลตลาด: Gold API • ExchangeRate-API", color: "#8A7040", size: "xxs", align: "center", margin: "sm" },
          { type: "text", text: "บอทแจ้งเตือนอัตโนมัติ — ไม่มีการตอบแชท", color: "#725523", size: "xs", align: "center", margin: "md" },
        ],
      },
      footer: {
        type: "box", layout: "vertical", contents: [
          { type: "button", style: "link", color: "#725500", action: { type: "uri", label: "ดูข้อมูลจากสมาคมค้าทองคำ", uri: price.sourceUrl } },
        ],
      },
    },
  };
}
