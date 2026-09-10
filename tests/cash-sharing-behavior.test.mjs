import test from "node:test";
import assert from "node:assert/strict";
import { splitCashPool, summarizeCashShares } from "../lib/cash-sharing.ts";

test("cash pool split rounds user share and assigns exact remainder to supplier", () => {
  assert.deepEqual(splitCashPool(5_832_090, 40), {
    cashPool: 5_832_090,
    yourShare: 2_332_836,
    supplierShare: 3_499_254
  });
});

test("supplier share remains exact remainder for fractional rupiah", () => {
  const result = splitCashPool(1, 40);
  assert.equal(result.yourShare, 0);
  assert.equal(result.supplierShare, 1);
  assert.equal(result.yourShare + result.supplierShare, result.cashPool);
});

test("recap totals equal the sum of rounded monthly rows", () => {
  const result = summarizeCashShares([1, 1], 40);
  assert.deepEqual(result, {
    cashPool: 2,
    yourShare: 0,
    supplierShare: 2
  });
});
