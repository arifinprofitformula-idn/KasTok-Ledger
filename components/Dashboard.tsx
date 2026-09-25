"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import BusinessReport from "@/components/BusinessReport";
import LedgerView from "@/components/LedgerView";
import LogoutButton from "@/components/LogoutButton";
import PerformanceChart from "@/components/PerformanceChart";
import ProductSales from "@/components/ProductSales";
import SplitControls from "@/components/SplitControls";
import UploadDropzone from "@/components/UploadDropzone";
import { applyDateFilter, groupByPeriod, summarize } from "@/lib/calculations";
import { splitCashPool } from "@/lib/cash-sharing";
import { clearPrintArea, exportMonthlyRecap } from "@/lib/export";
import { fmt } from "@/lib/format";
import { summarizeOrderItems } from "@/lib/order-calculations";
import { buildBusinessReport } from "@/lib/business-calculations";
import { parseFinancialWorkbook } from "@/lib/financial-parser";
import { detectWorkbookType, parseOrderWorkbook } from "@/lib/order-parser";
import { parseFiles, parseWorkbook } from "@/lib/parser";
import type { DateFilter, FinancialEntry, FinancialImport, Granularity, OrderImport, OrderItem, OrderItemCostSnapshot, ParsedFinancialBatch, ParsedOrderBatch, SkuCost, Transaction } from "@/lib/types";

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
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [financialImports, setFinancialImports] = useState<FinancialImport[]>([]);
  const [costs, setCosts] = useState<SkuCost[]>([]);
  const [costSnapshots, setCostSnapshots] = useState<OrderItemCostSnapshot[]>([]);
  const [activeModule, setActiveModule] = useState<"finance" | "products" | "business">(
    initialTransactions.length ? "finance" : initialOrderItems.length ? "products" : "finance"
  );
  const [splitYou, setSplitYou] = useState(40);
  const [splitSupplier, setSplitSupplier] = useState(60);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [filter, setFilter] = useState<DateFilter>({ from: "", to: "" });
  const [status, setStatusState] = useState<{ text: string; kind?: "ok" | "err" }>({
    text: initialError ? `Data belum siap dibuka. Periksa koneksi penyimpanan lokal, lalu coba muat ulang. Detail: ${initialError}` : "",
    kind: initialError ? "err" : undefined
  });

  function setStatus(text: string, kind?: "ok" | "err") {
    setStatusState({ text, kind });
  }

  useEffect(() => {
    window.addEventListener("afterprint", clearPrintArea);
    Promise.all([refreshOrders(true), refreshBusiness()]).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Gagal memuat data pesanan.", "err");
    });
    return () => window.removeEventListener("afterprint", clearPrintArea);
    // Data pesanan dimuat di client agar ribuan baris tidak membengkakkan HTML SSR.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTransactions = useMemo(() => applyDateFilter(transactions, filter), [transactions, filter]);
  const hero = useMemo(() => {
    const monthly = groupByPeriod("month", filteredTransactions);
    const cashPool = Object.keys(monthly).reduce((sum, key) => sum + summarize(monthly[key]).gross, 0);
    const shares = splitCashPool(cashPool, splitYou);
    return { cashPool, you: shares.yourShare, supplier: shares.supplierShare };
  }, [filteredTransactions, splitYou]);
  const productHero = useMemo(() => summarizeOrderItems(orderItems), [orderItems]);
  const businessHero = useMemo(() => buildBusinessReport(orderItems, financialEntries, costSnapshots), [orderItems, financialEntries, costSnapshots]);

  async function refreshTransactions() {
    const response = await fetch("/api/transactions");
    if (!response.ok) {
      setStatus("Gagal memuat ulang data. Coba muat ulang halaman.", "err");
      return;
    }
    const data = await response.json();
    setTransactions((data.transactions || []) as Transaction[]);
  }

  async function refreshOrders(selectProductsWhenFinanceIsEmpty = false) {
    const response = await fetch("/api/orders");
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Gagal memuat laporan pesanan. Coba muat ulang halaman.");
    }
    const data = await response.json();
    const nextItems = (data.items || []) as OrderItem[];
    setOrderItems(nextItems);
    setOrderImports((data.imports || []) as OrderImport[]);
    if (selectProductsWhenFinanceIsEmpty && !initialTransactions.length && nextItems.length) setActiveModule("products");
  }

  async function refreshCosts() {
    const response = await fetch("/api/costs");
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Gagal memuat daftar modal produk.");
    setCosts((data.costs || []) as SkuCost[]);
    setCostSnapshots((data.snapshots || []) as OrderItemCostSnapshot[]);
  }

  async function refreshBusiness() {
    const [financeResponse, costResponse] = await Promise.all([fetch("/api/finance"), fetch("/api/costs")]);
    const financeData = await financeResponse.json().catch(() => null);
    const costData = await costResponse.json().catch(() => null);
    if (!financeResponse.ok) throw new Error(financeData?.error || "Gagal memuat rincian pembayaran.");
    if (!costResponse.ok) throw new Error(costData?.error || "Gagal memuat daftar modal produk.");
    setFinancialEntries((financeData.entries || []) as FinancialEntry[]);
    setFinancialImports((financeData.imports || []) as FinancialImport[]);
    setCosts((costData.costs || []) as SkuCost[]);
    setCostSnapshots((costData.snapshots || []) as OrderItemCostSnapshot[]);
  }

  async function handleFiles(files: File[]) {
    setStatus("Membaca laporan dan mengecek isinya...", "ok");
    const existingKeys = new Set(transactions.map((item) => item.dedupe_key));
    const transactionFiles: File[] = [];
    const orderBatches: ParsedOrderBatch[] = [];
    const financialBatches: ParsedFinancialBatch[] = [];
    const financialTransactions: Transaction[] = [];
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
        else if (type === "financial") {
          financialBatches.push(await parseFinancialWorkbook(buffer, file.name));
          const cash = parseWorkbook(buffer, file.name, existingKeys);
          financialTransactions.push(...cash.transactions);
        }
        else if (type === "transactions") transactionFiles.push(file);
        else errors.push(`${file.name}: format laporan belum dikenali. Upload laporan pesanan, pembayaran, atau penarikan dari TikTok Shop.`);
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "gagal dibaca"}`);
      }
    }

    const parsed = transactionFiles.length
      ? await parseFiles(transactionFiles, existingKeys)
      : { transactions: [] as Transaction[], skipped: 0, errors: [] as string[] };
    parsed.transactions.push(...financialTransactions);
    errors.push(...parsed.errors);
    const knownFileHashes = new Set(orderImports.map((item) => item.file_hash));
    const pendingOrderBatches = orderBatches.filter((batch) => !knownFileHashes.has(batch.fileHash));
    const knownDuplicateFiles = orderBatches.length - pendingOrderBatches.length;
    const knownFinanceHashes = new Set(financialImports.map((item) => item.file_hash));
    const pendingFinancialBatches = financialBatches.filter((batch) => !knownFinanceHashes.has(batch.fileHash));
    const knownDuplicateFinanceFiles = financialBatches.length - pendingFinancialBatches.length;

    if (errors.length) {
      setStatus(errors.join(" · "), "err");
      return;
    }

    if (!parsed.transactions.length && !pendingOrderBatches.length && !pendingFinancialBatches.length) {
      const totalDuplicateFiles = knownDuplicateFiles + knownDuplicateFinanceFiles;
      const duplicateText = totalDuplicateFiles ? `, ${totalDuplicateFiles} laporan yang sama dilewati` : parsed.skipped ? `, ${parsed.skipped} catatan ganda dilewati` : "";
      setStatus(`Tidak ada data baru${duplicateText}.`, "ok");
      return;
    }

    if (pendingFinancialBatches.length) {
      const entryCount = pendingFinancialBatches.reduce((sum, batch) => sum + batch.entries.length, 0);
      const difference = pendingFinancialBatches.reduce((sum, batch) => sum + Math.abs(batch.reconciliationDifference || 0), 0);
      const confirmed = window.confirm(
        `Ringkasan laporan pembayaran\n\n${entryCount.toLocaleString("id-ID")} rincian pembayaran terbaca\n` +
        `${difference ? `Catatan: ada selisih ${fmt(difference)} antara ringkasan dan rincian\n` : "Ringkasan dan rincian sudah sesuai\n"}` +
        `\nSimpan laporan ini?`
      );
      if (!confirmed) {
        setStatus("Upload dibatalkan. Tidak ada data yang disimpan.", "ok");
        return;
      }
    }

    if (pendingOrderBatches.length) {
      const previewItems = pendingOrderBatches.flatMap((batch) => batch.items);
      const preview = summarizeOrderItems(previewItems);
      const currentKeys = new Set(orderItems.map((item) => item.dedupe_key));
      const updates = previewItems.filter((item) => currentKeys.has(item.dedupe_key)).length;
      const newRows = previewItems.length - updates;
      const confirmed = window.confirm(
        `Ringkasan laporan produk\n\n` +
          `${previewItems.length.toLocaleString("id-ID")} rincian produk terbaca\n` +
          `${newRows.toLocaleString("id-ID")} data baru\n` +
          `${updates.toLocaleString("id-ID")} data lama akan diperbarui\n` +
          `${preview.netSold.toLocaleString("id-ID")} unit terjual bersih\n\n` +
          `Simpan laporan ini?`
      );
      if (!confirmed) {
        setStatus("Upload dibatalkan. Tidak ada data yang disimpan.", "ok");
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
        setStatus(`Gagal menyimpan data penarikan: ${data?.error || "Coba ulangi beberapa saat lagi."}`, "err");
        return;
      }
      savedTransactions = parsed.transactions.length;
      await refreshTransactions();
      setSelectedMonth("all");
    }

    let savedOrders = 0;
    let duplicateFiles = knownDuplicateFiles + knownDuplicateFinanceFiles;
    for (const batch of pendingOrderBatches) {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: batch.fileName, fileHash: batch.fileHash, items: batch.items })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(`Gagal menyimpan ${batch.fileName}: ${data?.error || "Coba ulangi beberapa saat lagi."}`, "err");
        return;
      }
      if (data?.duplicate) duplicateFiles += 1;
      else savedOrders += Number(data?.processed || 0);
    }
    if (pendingOrderBatches.length) {
      await refreshOrders();
      setActiveModule("products");
    }

    let savedFinancialEntries = 0;
    for (const batch of pendingFinancialBatches) {
      const response = await fetch("/api/finance", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batch)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(`Gagal menyimpan ${batch.fileName}: ${data?.error || "Coba ulangi beberapa saat lagi."}`, "err");
        return;
      }
      if (data?.duplicate) duplicateFiles += 1;
      else savedFinancialEntries += Number(data?.processed || 0);
    }
    if (pendingFinancialBatches.length) {
      await refreshBusiness();
      setActiveModule("business");
    }

    const parts = [];
    if (savedTransactions) parts.push(`${savedTransactions.toLocaleString("id-ID")} catatan penarikan tersimpan`);
    if (savedOrders) parts.push(`${savedOrders.toLocaleString("id-ID")} rincian produk tersimpan`);
    if (savedFinancialEntries) parts.push(`${savedFinancialEntries.toLocaleString("id-ID")} rincian pembayaran tersimpan`);
    if (duplicateFiles) parts.push(`${duplicateFiles} laporan yang sama dilewati`);
    if (parsed.skipped) parts.push(`${parsed.skipped} catatan ganda dilewati`);
    setStatus(`Berhasil: ${parts.join(" · ") || "tidak ada perubahan"}.`, "ok");
  }

  return (
    <main className="wrap">
      <div className="brand-badge" title="KasTok Ledger">
        <Image src="/kastok-logo.webp" alt="Tokopedia dan TikTok Shop" width={58} height={58} />
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
                <div className="fig"><div className="label">Dana Bersih Siap Dibagi</div><div className="num">{fmt(hero.cashPool)}</div></div>
                <div className="fig you"><div className="label">Bagian Anda</div><div className="num">{fmt(hero.you)}</div></div>
                <div className="fig supplier"><div className="label">Bagian Supplier + Modal</div><div className="num">{fmt(hero.supplier)}</div></div>
              </>
            ) : activeModule === "products" ? (
              <>
                <div className="fig"><div className="label">Terjual Bersih</div><div className="num">{productHero.netSold.toLocaleString("id-ID")}</div></div>
                <div className="fig you"><div className="label">Dalam Proses</div><div className="num">{(productHero.shipped + productHero.pending).toLocaleString("id-ID")}</div></div>
                <div className="fig supplier"><div className="label">Produk / Varian</div><div className="num">{productHero.uniqueProducts} / {productHero.uniqueSkus}</div></div>
              </>
            ) : <>
              <div className="fig"><div className="label">Pendapatan Diakui</div><div className="num">{fmt(businessHero.recognizedRevenue)}</div></div>
              <div className="fig you"><div className="label">Laba Produk</div><div className="num">{businessHero.missingCostUnits ? "Belum lengkap" : fmt(businessHero.contributionProfit)}</div></div>
              <div className="fig supplier"><div className="label">Kelengkapan Modal</div><div className="num">{businessHero.costCoverage === null ? "-" : `${Math.round(businessHero.costCoverage * 100)}%`}</div></div>
            </>}
          </div>
          <LogoutButton />
        </div>
      </header>

      <UploadDropzone onFiles={handleFiles} />
      <div className={`status ${status.kind || ""}`}>{status.text}</div>

      <div className="module-tabs">
        <button className={activeModule === "finance" ? "active" : ""} type="button" onClick={() => setActiveModule("finance")}>Bagi Hasil</button>
        <button className={activeModule === "products" ? "active" : ""} type="button" onClick={() => setActiveModule("products")}>Produk Terjual</button>
        <button className={activeModule === "business" ? "active" : ""} type="button" onClick={() => setActiveModule("business")}>Laba Produk</button>
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
            }}><Download size={16} /> Unduh Rekap Bagi Hasil</button>
          </div>
          <PerformanceChart transactions={filteredTransactions} granularity={granularity} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} setStatus={setStatus} />
          <LedgerView transactions={filteredTransactions} granularity={granularity} splitYou={splitYou} splitSupplier={splitSupplier} setStatus={setStatus} />
        </>
      ) : activeModule === "products" ? (
        <ProductSales items={orderItems} imports={orderImports} setStatus={setStatus} />
      ) : <BusinessReport items={orderItems} entries={financialEntries} imports={financialImports} costs={costs} snapshots={costSnapshots} refreshCosts={refreshCosts} setStatus={setStatus} />}

      <div id="printArea" />
      <footer>KasTok Ledger · Dana bersih dihitung dari dana masuk rekening dikurangi biaya promosi marketplace.</footer>
    </main>
  );
}
