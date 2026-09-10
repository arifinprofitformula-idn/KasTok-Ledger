export type CashShare = {
  cashPool: number;
  yourShare: number;
  supplierShare: number;
};

export function splitCashPool(cashPool: number, yourPercentage: number): CashShare {
  const yourShare = Math.round(cashPool * (yourPercentage / 100));
  return {
    cashPool,
    yourShare,
    supplierShare: cashPool - yourShare
  };
}

export function summarizeCashShares(cashPools: number[], yourPercentage: number): CashShare {
  return cashPools.reduce<CashShare>(
    (total, cashPool) => {
      const row = splitCashPool(cashPool, yourPercentage);
      return {
        cashPool: total.cashPool + row.cashPool,
        yourShare: total.yourShare + row.yourShare,
        supplierShare: total.supplierShare + row.supplierShare
      };
    },
    { cashPool: 0, yourShare: 0, supplierShare: 0 }
  );
}
