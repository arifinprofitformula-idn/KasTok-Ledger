import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import SetupRequired from "@/components/SetupRequired";
import { getCurrentUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { getAppEnv } from "@/lib/env";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!getAppEnv().isConfigured) {
    return <SetupRequired />;
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let data: Transaction[] = [];
  let initialError = "";

  try {
    const { rows } = await query<Omit<Transaction, "amount"> & { amount: string | number }>(
      `select id, user_id, reference_id, dedupe_key, type, transaction_date, date_raw, month_key, amount, source_file, created_at
       from transactions
       where user_id = $1
       order by transaction_date asc nulls first, created_at asc`,
      [user.id]
    );
    data = rows.map((row) => ({ ...row, amount: Number(row.amount) }));
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Gagal membaca database.";
  }

  return (
    <Dashboard
      initialTransactions={data}
      initialOrderItems={[]}
      initialOrderImports={[]}
      initialError={initialError}
      userEmail={user.email}
    />
  );
}
