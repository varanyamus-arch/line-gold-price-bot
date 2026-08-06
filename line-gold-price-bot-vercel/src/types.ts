export interface GoldPrice {
  barBuy: number;
  barSell: number;
  ornamentBase: number;
  ornamentSell: number;
  announcedAt: string;
  round: number | null;
  sourceUrl: string;
  fetchedAt: string;
}
