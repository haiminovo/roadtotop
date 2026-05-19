function normalizeNonNegativeInteger(value) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function calculateMarketFee(price, feeRatePercent) {
  const normalizedPrice = normalizeNonNegativeInteger(price);
  const normalizedFeeRate = Math.max(0, Math.min(100, Number(feeRatePercent) || 0));
  const feeAmount = Math.floor((normalizedPrice * normalizedFeeRate) / 100);

  return {
    feeAmount,
    sellerReceiveAmount: Math.max(0, normalizedPrice - feeAmount),
  };
}

module.exports = {
  calculateMarketFee,
  normalizeNonNegativeInteger,
};
