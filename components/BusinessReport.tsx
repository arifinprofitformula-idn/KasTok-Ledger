"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Search } from "lucide-react";
import HppManager from "@/components/HppManager";
import { buildBusinessReport, reconciliationStatus } from "@/lib/business-calculations";
import { exportBusinessReport } from "@/lib/export";
import { fmt } from "@/lib/format";
import type { FinancialEntry, FinancialImport, OrderItem, OrderItemCostSnapshot, SkuCost } from "@/lib/types";

type Props = {
  items: OrderItem[];
  entries: FinancialEntry[];
  imports: FinancialImport[];
  costs: SkuCost[];
  snapshots: OrderItemCostSnapshot[];
  refreshCosts: () => Promise<void>;
  setStatus: (value: string, kind?: "ok" | "err") => void;
};

const pct = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("id-ID");

export default function BusinessReport({ items, entries, imports, costs, snapshots, refreshCosts, setStatus }: Props) {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState({ from: "", to: "" });
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const value = String(entry.order_date || entry.payment_date || "").slice(0, 10);
    if (date.from && (!value || value < date.from)) return false;
    if (date.to && (!value || value > date.to)) return false;
    return true;
  }), [entries, date]);
  const report = useMemo(() => buildBusinessReport(items, filteredEntries, snapshots), [items, filteredEntries, snapshots]);
  const latest = imports[0];
  const recon = reconciliationStatus(latest);
  const rows = report.rows.filter((row) => `${row.productName} ${row.skuId} ${row.variation}`.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID")));

  if (!entries.length) return <section className="business-report">
    <div className="product-empty"><div><h3>Belum ada rincian pembayaran</h3><p>Upload laporan pembayaran dari TikTok Shop. Setelah itu sistem akan mencocokkan pembayaran dengan produk yang terjual.</p></div></div>
    {items.length ? <HppManager items={items} costs={costs} onChanged={refreshCosts} setStatus={setStatus} /> : null}
  </section>;

  return (
    <section className="business-report">
      <div className="business-head">
        <div><span className="eyebrow">Pendapatan · Biaya · Modal</span><h2>Laporan Laba Produk</h2><p>Laba produk dihitung dari pembayaran marketplace, produk terjual, dan modal produk yang Anda isi.</p></div>
        <button className="btn btn-ghost" type="button" onClick={() => { try { exportBusinessReport(report, filteredEntries, latest); } catch (error) { setStatus(error instanceof Error ? error.message : "Gagal mengekspor laporan.", "err"); } }}><Download size={16} /> Unduh Laporan Bisnis</button>
      </div>

      <div className="business-filters"><label>Dari<input type="date" value={date.from} onChange={(event) => setDate((current) => ({ ...current, from: event.target.value }))} /></label><label>Sampai<input type="date" value={date.to} onChange={(event) => setDate((current) => ({ ...current, to: event.target.value }))} /></label><button className="btn btn-sm btn-ghost" type="button" onClick={() => setDate({ from: "", to: "" })}>Reset periode</button></div>

      {latest ? <div className={`reconciliation ${recon}`}>
        {recon === "balanced" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
        <div><strong>{recon === "balanced" ? "Ringkasan dan rincian sudah sesuai" : "Ada selisih pada laporan pembayaran"}</strong><span>{latest.file_name} · Periode {String(latest.period_start || "-").slice(0, 10)} s.d. {String(latest.period_end || "-").slice(0, 10)} · Selisih {fmt(latest.reconciliation_difference || 0)}</span></div>
      </div> : null}

      <div className="business-kpis">
        <div><span>Pendapatan Diakui</span><strong>{fmt(report.recognizedRevenue)}</strong></div>
        <div><span>Biaya Marketplace</span><strong className="neg">{fmt(report.marketplaceFees)}</strong></div>
        <div><span>Diskon Penjual</span><strong>{fmt(report.sellerDiscount)}</strong></div>
        <div><span>Diskon Platform</span><strong>{fmt(report.platformDiscount)}</strong></div>
        <div><span>Modal Produk Tercatat</span><strong>{fmt(report.hpp)}</strong></div>
        <div className={report.contributionProfit >= 0 ? "positive" : "negative"}><span>Laba Produk{report.missingCostUnits ? " (sementara)" : ""}</span><strong>{fmt(report.contributionProfit)}</strong><small>{report.missingCostUnits ? `${number.format(report.missingCostUnits)} unit belum punya modal` : report.contributionMargin === null ? "-" : pct.format(report.contributionMargin)}</small></div>
        <div><span>Laba Kotor{report.missingCostUnits ? " (sementara)" : ""}</span><strong>{fmt(report.grossProfit)}</strong><small>{report.missingCostUnits ? "Lengkapi modal produk" : report.grossMargin === null ? "-" : pct.format(report.grossMargin)}</small></div>
        <div><span>Penyelesaian Bersih</span><strong>{fmt(report.settlement)}</strong></div>
      </div>

      <div className="quality-grid">
        <div><span>Pesanan terhubung</span><strong>{report.linkedOrders} / {report.totalOrderEntries}</strong></div>
        <div><span>Kelengkapan Modal</span><strong>{report.costCoverage === null ? "-" : pct.format(report.costCoverage)}</strong><small>{number.format(report.missingCostUnits)} unit belum punya modal</small></div>
        <div><span>Pembayaran belum cocok</span><strong>{report.unmatchedEntries}</strong></div>
        <div><span>Penyesuaian nonproduk</span><strong>{fmt(report.adjustments)}</strong></div>
      </div>

      <HppManager items={items} costs={costs} onChanged={refreshCosts} setStatus={setStatus} />

      <div className="report-grid">
        <div className="report-card grow"><div className="report-card-head"><div><h3>Laba per Produk</h3><p>Biaya pesanan dibagi ke tiap produk sesuai porsi pendapatannya.</p></div><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari produk atau kode barang" /></label></div>
          <div className="profit-table-wrap"><table className="profit-table"><thead><tr><th>Produk</th><th>Jumlah</th><th>Pendapatan</th><th>Biaya</th><th>Modal</th><th>Laba Produk</th><th>Margin</th></tr></thead><tbody>
            {rows.map((row) => <tr key={row.key}><td><strong>{row.productName}</strong><small>{row.variation || "Tanpa variasi"} · Kode barang {row.skuId}{row.missingCostUnits ? ` · ${row.missingCostUnits} unit belum punya modal` : ""}</small></td><td>{number.format(row.quantity)}</td><td>{fmt(row.revenue)}</td><td className="neg">{fmt(row.marketplaceFees)}</td><td>{fmt(row.hpp)}</td><td className={row.contribution >= 0 ? "pos" : "neg"}>{fmt(row.contribution)}</td><td>{row.margin === null ? "-" : pct.format(row.margin)}</td></tr>)}
          </tbody></table></div>
        </div>
        <div className="report-card fees"><h3>Rincian Biaya</h3><p>Biaya yang dipotong marketplace dari pembayaran pesanan.</p><div className="fee-list">
          {report.feeBreakdown.slice(0, 12).map((fee) => <div key={fee.label}><span>{fee.label}</span><strong className={fee.amount < 0 ? "neg" : "pos"}>{fmt(fee.amount)}</strong></div>)}
        </div></div>
      </div>
    </section>
  );
}
