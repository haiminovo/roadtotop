// ============================================================
// 经济系统计算
// ============================================================

export function normalizeNonNegativeInteger(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function calculateMarketFee(price: number, feePercent: number): { fee: number; sellerReceives: number } {
  const safePrice = normalizeNonNegativeInteger(price);
  const fee = Math.floor(safePrice * feePercent / 100);
  return { fee, sellerReceives: safePrice - fee };
}
