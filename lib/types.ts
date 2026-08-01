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
