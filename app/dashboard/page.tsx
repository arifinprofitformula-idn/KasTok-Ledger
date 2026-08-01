import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { createClient } from "@/lib/supabase/server";
import type { Transaction } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("transaction_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const initialError = error
    ? `${error.message}${error.details ? ` (${error.details})` : ""}`
    : "";

  return (
    <Dashboard
      initialTransactions={(data || []) as Transaction[]}
      initialError={initialError}
      userEmail={userData.user.email || ""}
      userId={userData.user.id}
    />
  );
}
