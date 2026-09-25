import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import type { Transaction, TransactionType } from "@/lib/types";

const TYPES: TransactionType[] = ["Withdrawal", "GMV Pay Deduction", "Earnings"];

type TransactionRow = Omit<Transaction, "amount"> & {
  amount: string | number;
};

function mapTransaction(row: TransactionRow): Transaction {
  return {
    ...row,
    amount: Number(row.amount)
  };
}

function isValidTransaction(item: Partial<Transaction>) {
  return Boolean(
    item &&
      typeof item.dedupe_key === "string" &&
      TYPES.includes(item.type as TransactionType) &&
      typeof item.date_raw === "string" &&
      typeof item.amount === "number" &&
      Number.isFinite(item.amount)
  );
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi login sudah berakhir. Silakan login ulang." }, { status: 401 });

  const { rows } = await query<TransactionRow>(
    `select id, user_id, reference_id, dedupe_key, type, transaction_date, date_raw, month_key, amount, source_file, created_at
     from transactions
     where user_id = $1
     order by transaction_date asc nulls first, created_at asc`,
    [user.id]
  );

  return NextResponse.json({ transactions: rows.map(mapTransaction) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi login sudah berakhir. Silakan login ulang." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const transactions = Array.isArray(body?.transactions) ? body.transactions as Partial<Transaction>[] : [];

  if (!transactions.length || transactions.some((item) => !isValidTransaction(item))) {
    return NextResponse.json({ error: "Isi laporan penarikan tidak valid atau belum lengkap." }, { status: 400 });
  }

  const values: unknown[] = [];
  const placeholders = transactions.map((item, index) => {
    const offset = index * 9;
    values.push(
      user.id,
      item.reference_id || null,
      item.dedupe_key,
      item.type,
      item.transaction_date || null,
      item.date_raw,
      item.month_key || null,
      item.amount,
      item.source_file || null
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
  }).join(", ");

  await query(
    `insert into transactions
      (user_id, reference_id, dedupe_key, type, transaction_date, date_raw, month_key, amount, source_file)
     values ${placeholders}
     on conflict (user_id, dedupe_key) do nothing`,
    values
  );

  return NextResponse.json({ ok: true });
}
