export type TransactionType = "Withdrawal" | "GMV Pay Deduction" | "Earnings";

export type Transaction = {
  id?: string;
  user_id?: string;
  reference_id: string | null;
  dedupe_key: string;
  type: TransactionType;
  transaction_date: string | null;
  date_raw: string;
  month_key: string | null;
  amount: number;
  source_file?: string | null;
  created_at?: string;
};

export type Granularity = "day" | "week" | "month";

export type Summary = {
  withdrawal: number;
  gmv: number;
  earnings: number;
  gross: number;
};

export type DateFilter = {
  from: string;
  to: string;
};

export type OrderItem = {
  id?: string;
  user_id?: string;
  order_id: string;
  sku_id: string;
  seller_sku: string;
  product_name: string;
  variation: string;
  quantity: number;
  returned_quantity: number;
  order_status: string;
  order_substatus: string;
  order_created_at: string;
  order_date: string;
  month_key: string;
  unit_original_price: number | null;
  sku_subtotal_before_discount: number | null;
  sku_platform_discount: number | null;
  sku_seller_discount: number | null;
  sku_subtotal_after_discount: number | null;
  source_file: string;
  source_row: number;
  dedupe_key: string;
  updated_at?: string;
};

export type OrderImport = {
  id: string;
  file_name: string;
  file_hash: string;
  row_count: number;
  imported_at: string;
};

export type ParsedOrderBatch = {
  fileName: string;
  fileHash: string;
  items: OrderItem[];
  skipped: number;
  warnings: string[];
};

export type FinancialComponent = {
  id?: string;
  finance_entry_id?: string;
  code: string;
  label: string;
  column_index: number;
  amount: number;
};

export type FinancialEntry = {
  id?: string;
  import_id?: string;
  transaction_id: string;
  transaction_type: string;
  order_date: string | null;
  payment_date: string | null;
  currency: string;
  settlement_amount: number;
  total_revenue: number;
  total_fees: number;
  adjustment_amount: number;
  related_order_id: string | null;
  buyer_payment: number;
  platform_discount: number;
  seller_discount: number;
  product_detail: string;
  source_row: number;
  dedupe_key: string;
  components: FinancialComponent[];
};

export type FinancialImport = {
  id: string;
  file_name: string;
  file_hash: string;
  period_start: string | null;
  period_end: string | null;
  currency: string;
  summary_settlement: number | null;
  summary_revenue: number | null;
  summary_fees: number | null;
  summary_adjustments: number | null;
  detail_settlement: number;
  reconciliation_difference: number | null;
  row_count: number;
  imported_at: string;
};

export type ParsedFinancialBatch = {
  fileName: string;
  fileHash: string;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  summarySettlement: number | null;
  summaryRevenue: number | null;
  summaryFees: number | null;
  summaryAdjustments: number | null;
  detailSettlement: number;
  reconciliationDifference: number | null;
  entries: FinancialEntry[];
  warnings: string[];
};

export type SkuCost = {
  id: string;
  sku_id: string;
  variation: string;
  effective_from: string;
  purchase_cost: number;
  inbound_freight: number;
  direct_handling: number;
  packaging_cost: number;
  other_direct_cost: number;
  total_unit_cost: number;
  supplier: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type OrderItemCostSnapshot = {
  order_item_id: string;
  cost_history_id: string;
  total_unit_cost: number;
  applied_at: string;
};
