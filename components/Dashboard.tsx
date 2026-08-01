"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import LedgerView from "@/components/LedgerView";
import LogoutButton from "@/components/LogoutButton";
import PerformanceChart from "@/components/PerformanceChart";
import SplitControls from "@/components/SplitControls";
import UploadDropzone from "@/components/UploadDropzone";
import { applyDateFilter, groupByPeriod, summarize } from "@/lib/calculations";
import { clearPrintArea, exportMonthlyRecap } from "@/lib/export";
import { fmt } from "@/lib/format";
import { parseFiles } from "@/lib/parser";
import { createClient } from "@/lib/supabase/client";
import type { DateFilter, Granularity, Transaction } from "@/lib/types";

type Props = {
  initialTransactions: Transaction[];
  initialError?: string;
  userEmail: string;
  userId: string;
};

export default function Dashboard({ initialTransactions, initialError = "", userEmail, userId }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [splitYou, setSplitYou] = useState(40);
  const [splitSupplier, setSplitSupplier] = useState(60);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [filter, setFilter] = useState<DateFilter>({ from: "", to: "" });
  const [status, setStatusState] = useState<{ text: string; kind?: "ok" | "err" }>({
    text: initialError ? `Gagal membaca tabel transactions. Pastikan supabase/schema.sql sudah dijalankan. Detail: ${initialError}` : "",
    kind: initialError ? "err" : undefined
  });

  function setStatus(text: string, kind?: "ok" | "err") {
    setStatusState({ text, kind });
  }

  useEffect(() => {
    window.addEventListener("afterprint", clearPrintArea);
    return () => window.removeEventListener("afterprint", clearPrintArea);
  }, []);

  const filteredTransactions = useMemo(() => applyDateFilter(transactions, filter), [transactions, filter]);
  const hero = useMemo(() => {
    const monthly = groupByPeriod("month", filteredTransactions);
    const gross = Object.keys(monthly).reduce((sum, key) => sum + summarize(monthly[key]).gross, 0);
    return { gross, you: gross * (splitYou / 100), supplier: gross * (splitSupplier / 100) };
  }, [filteredTransactions, splitYou, splitSupplier]);

  async function refreshTransactions() {
    const supabase = createClient();
    const { data, error } = await supabase.from("transactions").select("*").eq("user_id", userId).order("transaction_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
    if (error) {
      setStatus("Gagal memuat ulang data dari database.", "err");
      return;
    }
    setTransactions((data || []) as Transaction[]);
  }

  async function handleFiles(files: File[]) {
    setStatus("Membaca file dan menyiapkan transaksi...", "ok");
    const existingKeys = new Set(transactions.map((item) => item.dedupe_key));
    const parsed = await parseFiles(files, existingKeys);

    if (parsed.errors.length) {
      setStatus(parsed.errors.join(" · "), "err");
      return;
    }

    if (!parsed.transactions.length) {
      setStatus(`Tidak ada transaksi baru${parsed.skipped ? `, ${parsed.skipped} duplikat dilewati` : ""}.`, "ok");
      return;
    }

    const supabase = createClient();
    const payload = parsed.transactions.map((item) => ({ ...item, user_id: userId }));
    const { error } = await supabase.from("transactions").upsert(payload, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });

    if (error) {
      setStatus(`Gagal menyimpan ke database: ${error.message}`, "err");
      return;
    }

    await refreshTransactions();
    setSelectedMonth("all");
    setStatus(`Berhasil: ${parsed.transactions.length} transaksi baru disimpan${parsed.skipped ? `, ${parsed.skipped} duplikat dilewati` : ""}.`, "ok");
  }

  return (
    <main className="wrap">
      <div className="brand-badge" title="KasTok Ledger">
        <Image src="/kastok-logo.svg" alt="KasTok Ledger" width={46} height={46} />
      </div>

      <header className="hero">
        <div className="hero-title">
          <span className="eyebrow">Buku Kas Digital</span>
          <h1>KasTok Ledger</h1>
          <div className="platform-tags">
            <span className="ptag">Tokopedia Seller</span>
            <span className="ptag">TikTok Shop</span>
            <span className="ptag">{userEmail}</span>
          </div>
        </div>
        <div className="hero-actions">
          <div className="hero-figures">
            <div className="fig">
              <div className="label">Gross Profit</div>
              <div className="num">{fmt(hero.gross)}</div>
            </div>
            <div className="fig you">
              <div className="label">Bagian Anda</div>
              <div className="num">{fmt(hero.you)}</div>
            </div>
            <div className="fig supplier">
              <div className="label">Bagian Supplier</div>
              <div className="num">{fmt(hero.supplier)}</div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <UploadDropzone onFiles={handleFiles} />
      <div className={`status ${status.kind || ""}`}>{status.text}</div>

      <SplitControls
        splitYou={splitYou}
        setSplitYou={setSplitYou}
        splitSupplier={splitSupplier}
        setSplitSupplier={setSplitSupplier}
        granularity={granularity}
        setGranularity={setGranularity}
        filter={filter}
        setFilter={setFilter}
      />

      <div className="export-row">
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            try {
              exportMonthlyRecap(filteredTransactions, splitYou, splitSupplier);
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "Gagal mengekspor rekap.", "err");
            }
          }}
        >
          <Download size={16} />
          Unduh Rekap Bulanan (.xlsx)
        </button>
      </div>

      <PerformanceChart transactions={filteredTransactions} granularity={granularity} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} setStatus={setStatus} />
      <LedgerView transactions={filteredTransactions} granularity={granularity} splitYou={splitYou} splitSupplier={splitSupplier} setStatus={setStatus} />

      <div id="printArea" />
      <footer>KasTok Ledger · Gross Profit = Total Earnings - Total GMV Pay Deduction</footer>
    </main>
  );
}
