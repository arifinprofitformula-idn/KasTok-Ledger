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
