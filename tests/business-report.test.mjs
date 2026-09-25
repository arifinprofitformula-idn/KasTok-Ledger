import test from "node:test";
import assert from "node:assert/strict";
import { buildBusinessReport, reconciliationStatus } from "../lib/business-calculations.ts";

const item = {
  id: "item-1", order_id: "100", sku_id: "SKU-1", seller_sku: "", product_name: "Produk A",
  variation: "Merah", quantity: 2, returned_quantity: 0, order_status: "Selesai", order_substatus: "",
  order_created_at: "2026-09-01 10:00:00", order_date: "2026-09-01", month_key: "2026-09",
  unit_original_price: 60_000, sku_subtotal_before_discount: 120_000, sku_platform_discount: 10_000,
  sku_seller_discount: 5_000, sku_subtotal_after_discount: 105_000, source_file: "orders.xlsx",
  source_row: 2, dedupe_key: "100|SKU-1|Merah"
};

const entry = {
  id: "entry-1", transaction_id: "100", transaction_type: "Pesanan", order_date: "2026-09-01",
  payment_date: "2026-09-01", currency: "IDR", settlement_amount: 92_000, total_revenue: 115_000,
  total_fees: -23_000, adjustment_amount: 0, related_order_id: null, buyer_payment: 120_000,
  platform_discount: 10_000, seller_discount: -5_000, product_detail: "", source_row: 2,
  dedupe_key: "100|Pesanan", components: [{ code: "commission_1", label: "Komisi", column_index: 15, amount: -23_000 }]
};

test("business report links order, allocates fees, and subtracts snapshotted HPP", () => {
  const report = buildBusinessReport([item], [entry], [{ order_item_id: "item-1", cost_history_id: "cost-1", total_unit_cost: 30_000, applied_at: "2026-09-02" }]);
  assert.equal(report.linkedOrders, 1);
  assert.equal(report.recognizedRevenue, 115_000);
  assert.equal(report.marketplaceFees, 23_000);
  assert.equal(report.sellerDiscount, 5_000);
  assert.equal(report.platformDiscount, 10_000);
  assert.equal(report.hpp, 60_000);
  assert.equal(report.contributionProfit, 32_000);
  assert.equal(report.rows[0].contribution, 32_000);
  assert.equal(report.costCoverage, 1);
});

test("business report surfaces missing HPP and unlinked orders", () => {
  const report = buildBusinessReport([item], [{ ...entry, transaction_id: "not-found" }], []);
  assert.equal(report.unmatchedEntries, 1);
  assert.equal(report.linkedOrders, 0);
  assert.equal(report.costCoverage, null);
});

test("reconciliation tolerance only marks sub-rupiah differences balanced", () => {
  assert.equal(reconciliationStatus({ reconciliation_difference: 0.1 }), "balanced");
  assert.equal(reconciliationStatus({ reconciliation_difference: 10 }), "warning");
});
