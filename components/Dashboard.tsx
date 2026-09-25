"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import LedgerView from "@/components/LedgerView";
import LogoutButton from "@/components/LogoutButton";
import PerformanceChart from "@/components/PerformanceChart";
import ProductSales from "@/components/ProductSales";
import SplitControls from "@/components/SplitControls";
import UploadDropzone from "@/components/UploadDropzone";
import { applyDateFilter, groupByPeriod, summarize } from "@/lib/calculations";
import { clearPrintArea, exportMonthlyRecap } from "@/lib/export";
import { fmt } from "@/lib/format";
import { summarizeOrderItems } from "@/lib/order-calculations";
import { detectWorkbookType, parseOrderWorkbook } from "@/lib/order-parser";
import { parseFiles } from "@/lib/parser";
import type { DateFilter, Granularity, OrderImport, OrderItem, ParsedOrderBatch, Transaction } from "@/lib/types";

type Props = {
  initialTransactions: Transaction[];
  initialOrderItems: OrderItem[];
  initialOrderImports: OrderImport[];
  initialError?: string;
  userEmail: string;
};

export default function Dashboard({ initialTransactions, initialOrderItems, initialOrderImports, initialError = "", userEmail }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [orderItems, setOrderItems] = useState<OrderItem[]>(initialOrderItems);
  const [orderImports, setOrderImports] = useState<OrderImport[]>(initialOrderImports);
  const [activeModule, setActiveModule] = useState<"finance" | "products">(
    initialTransactions.length ? "finance" : initialOrderItems.length ? "products" : "finance"
  );
  const [splitYou, setSplitYou] = useState(40);
  const [splitSupplier, setSplitSupplier] = useState(60);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [filter, setFilter] = useState<DateFilter>({ from: "", to: "" });
  const [status, setStatusState] = useState<{ text: string; kind?: "ok" | "err" }>({
    text: initialError ? `Gagal membaca database. Jalankan npm run db:migrate dan periksa konfigurasi. Detail: ${initialError}` : "",
    kind: initialError ? "err" : undefined
  });

  function setStatus(text: string, kind?: "ok" | "err") {
    setStatusState({ text, kind });
  }

  useEffect(() => {
    window.addEventListener("afterprint", clearPrintArea);
    refreshOrders(true).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Gagal memuat data pesanan.", "err");
    });
    return () => window.removeEventListener("afterprint", clearPrintArea);
    // Data pesanan dimuat di client agar ribuan baris tidak membengkakkan HTML SSR.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTransactions = useMemo(() => applyDateFilter(transactions, filter), [transactions, filter]);
  const hero = useMemo(() => {
    const monthly = groupByPeriod("month", filteredTransactions);
    const gross = Object.keys(monthly).reduce((sum, key) => sum + summarize(monthly[key]).gross, 0);
    return { gross, you: gross * (splitYou / 100), supplier: gross * (splitSupplier / 100) };
  }, [filteredTransactions, splitYou, splitSupplier]);
  const productHero = useMemo(() => summarizeOrderItems(orderItems), [orderItems]);

  async function refreshTransactions() {
    const response = await fetch("/api/transactions");
    if (!response.ok) {
      setStatus("Gagal memuat ulang data dari database.", "err");
      return;
    }
    const data = await response.json();
    setTransactions((data.transactions || []) as Transaction[]);
  }

  async function refreshOrders(selectProductsWhenFinanceIsEmpty = false) {
    const response = await fetch("/api/orders");
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Gagal memuat data pesanan. Jalankan npm run db:migrate.");
    }
    const data = await response.json();
    const nextItems = (data.items || []) as OrderItem[];
    setOrderItems(nextItems);
    setOrderImports((data.imports || []) as OrderImport[]);
    if (selectProductsWhenFinanceIsEmpty && !initialTransactions.length && nextItems.length) setActiveModule("products");
  }

  async function handleFiles(files: File[]) {
    setStatus("Membaca dan memvalidasi file...", "ok");
    const existingKeys = new Set(transactions.map((item) => item.dedupe_key));
    const transactionFiles: File[] = [];
    const orderBatches: ParsedOrderBatch[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        if (file.size > 20 * 1024 * 1024) {
          errors.push(`${file.name}: ukuran file melebihi batas 20 MB.`);
          continue;
        }
        const buffer = await file.arrayBuffer();
        const type = detectWorkbookType(buffer);
        if (type === "orders") orderBatches.push(await parseOrderWorkbook(buffer, file.name));
        else if (type === "transactions") transactionFiles.push(file);
        else errors.push(`${file.name}: sheet OrderSKUList atau Riwayat penarikan tidak ditemukan.`);
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "gagal dibaca"}`);
      }
    }

    const parsed = transactionFiles.length
      ? await parseFiles(transactionFiles, existingKeys)
      : { transactions: [] as Transaction[], skipped: 0, errors: [] as string[] };
    errors.push(...parsed.errors);
    const knownFileHashes = new Set(orderImports.map((item) => item.file_hash));
    const pendingOrderBatches = orderBatches.filter((batch) => !knownFileHashes.has(batch.fileHash));
    const knownDuplicateFiles = orderBatches.length - pendingOrderBatches.length;

    if (errors.length) {
      setStatus(errors.join(" · "), "err");
      return;
    }

    if (!parsed.transactions.length && !pendingOrderBatches.length) {
      const duplicateText = knownDuplicateFiles ? `, ${knownDuplicateFiles} file identik dilewati` : parsed.skipped ? `, ${parsed.skipped} duplikat dilewati` : "";
      setStatus(`Tidak ada data baru${duplicateText}.`, "ok");
      return;
    }

    if (pendingOrderBatches.length) {
      const previewItems = pendingOrderBatches.flatMap((batch) => batch.items);
      const preview = summarizeOrderItems(previewItems);
      const currentKeys = new Set(orderItems.map((item) => item.dedupe_key));
      const updates = previewItems.filter((item) => currentKeys.has(item.dedupe_key)).length;
      const newRows = previewItems.length - updates;
      const confirmed = window.confirm(
        `Preview laporan produk\n\n` +
          `${previewItems.length.toLocaleString("id-ID")} baris valid\n` +
          `${newRows.toLocaleString("id-ID")} baris baru\n` +
          `${updates.toLocaleString("id-ID")} baris akan diperbarui\n` +
          `${preview.netSold.toLocaleString("id-ID")} unit terjual bersih\n\n` +
          `Lanjutkan simpan ke database?`
      );
      if (!confirmed) {
        setStatus("Impor dibatalkan. Tidak ada data yang disimpan.", "ok");
        return;
      }
    }

    let savedTransactions = 0;
    if (parsed.transactions.length) {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: parsed.transactions })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setStatus(`Gagal menyimpan transaksi: ${data?.error || "Request gagal."}`, "err");
        return;
      }
      savedTransactions = parsed.transactions.length;
      await refreshTransactions();
      setSelectedMonth("all");
    }

    let savedOrders = 0;
    let duplicateFiles = knownDuplicateFiles;
    for (const batch of pendingOrderBatches) {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: batch.fileName, fileHash: batch.fileHash, items: batch.items })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(`Gagal menyimpan ${batch.fileName}: ${data?.error || "Request gagal."}`, "err");
        return;
      }
      if (data?.duplicate) duplicateFiles += 1;
      else savedOrders += Number(data?.processed || 0);
    }
    if (pendingOrderBatches.length) {
      await refreshOrders();
      setActiveModule("products");
    }

    const parts = [];
    if (savedTransactions) parts.push(`${savedTransactions.toLocaleString("id-ID")} transaksi keuangan`);
    if (savedOrders) parts.push(`${savedOrders.toLocaleString("id-ID")} baris pesanan diproses`);
    if (duplicateFiles) parts.push(`${duplicateFiles} file identik dilewati`);
    if (parsed.skipped) parts.push(`${parsed.skipped} transaksi duplikat dilewati`);
    setStatus(`Berhasil: ${parts.join(" · ") || "tidak ada perubahan"}.`, "ok");
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
            {activeModule === "finance" ? (
              <>
                <div className="fig"><div className="label">Gross Profit</div><div className="num">{fmt(hero.gross)}</div></div>
                <div className="fig you"><div className="label">Bagian Anda</div><div className="num">{fmt(hero.you)}</div></div>
                <div className="fig supplier"><div className="label">Bagian Supplier</div><div className="num">{fmt(hero.supplier)}</div></div>
              </>
            ) : (
              <>
                <div className="fig"><div className="label">Terjual Bersih</div><div className="num">{productHero.netSold.toLocaleString("id-ID")}</div></div>
                <div className="fig you"><div className="label">Dalam Proses</div><div className="num">{(productHero.shipped + productHero.pending).toLocaleString("id-ID")}</div></div>
                <div className="fig supplier"><div className="label">Produk / SKU</div><div className="num">{productHero.uniqueProducts} / {productHero.uniqueSkus}</div></div>
              </>
            )}
          </div>
          <LogoutButton />
        </div>
      </header>

      <UploadDropzone onFiles={handleFiles} />
      <div className={`status ${status.kind || ""}`}>{status.text}</div>

      <div className="module-tabs">
        <button className={activeModule === "finance" ? "active" : ""} type="button" onClick={() => setActiveModule("finance")}>Rekap Keuangan</button>
        <button className={activeModule === "products" ? "active" : ""} type="button" onClick={() => setActiveModule("products")}>Produk Terjual</button>
      </div>

      {activeModule === "finance" ? (
        <>
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
            <button className="btn btn-ghost" type="button" onClick={() => {
              try { exportMonthlyRecap(filteredTransactions, splitYou, splitSupplier); }
              catch (error) { setStatus(error instanceof Error ? error.message : "Gagal mengekspor rekap.", "err"); }
            }}><Download size={16} /> Unduh Rekap Bulanan (.xlsx)</button>
          </div>
          <PerformanceChart transactions={filteredTransactions} granularity={granularity} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} setStatus={setStatus} />
          <LedgerView transactions={filteredTransactions} granularity={granularity} splitYou={splitYou} splitSupplier={splitSupplier} setStatus={setStatus} />
        </>
      ) : (
        <ProductSales items={orderItems} imports={orderImports} setStatus={setStatus} />
      )}

      <div id="printArea" />
      <footer>KasTok Ledger · Gross Profit = Total Withdrawal - Total GMV Pay Deduction</footer>
    </main>
  );
}
