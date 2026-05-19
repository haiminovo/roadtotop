export function normalizeNonNegativeInteger(value: unknown): number;

export function calculateMarketFee(
  price: unknown,
  feeRatePercent: unknown,
): {
  feeAmount: number;
  sellerReceiveAmount: number;
};
