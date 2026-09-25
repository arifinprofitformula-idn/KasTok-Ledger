"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, PackageCheck, RotateCcw, Search, Truck } from "lucide-react";
import { aggregateProductSales, filterOrderItems, summarizeOrderItems, type OrderStatusFilter } from "@/lib/order-calculations";
import { exportProductSalesRecap } from "@/lib/export";
import type { DateFilter, OrderImport, OrderItem } from "@/lib/types";

type Props = {
  items: OrderItem[];
  imports: OrderImport[];
  setStatus: (value: string, kind?: "ok" | "err") => void;
};

const number = new Intl.NumberFormat("id-ID");

export default function ProductSales({ items, imports, setStatus }: Props) {
  const [date, setDate] = useState<DateFilter>({ from: "", to: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const filtered = useMemo(
    () => filterOrderItems(items, { ...date, search, status: statusFilter }),
    [items, date, search, statusFilter]
  );
  const summary = useMemo(() => summarizeOrderItems(filtered), [filtered]);
  const products = useMemo(() => aggregateProductSales(filtered), [filtered]);
  const latestImport = imports[0];

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="product-sales">
      <div className="product-head">
        <div>
          <span className="eyebrow">OrderSKUList</span>
          <h2>Laporan Produk Terjual</h2>
          <p>Penjualan final hanya menghitung status Selesai dan otomatis mengurangi quantity retur.</p>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            try {
              exportProductSalesRecap(filtered);
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "Gagal mengekspor rekap produk.", "err");
            }
          }}
        >
          <Download size={16} /> Unduh Rekap Produk
        </button>
      </div>

      {latestImport ? (
        <div className="import-note">
          Impor terakhir: <strong>{latestImport.file_name}</strong> · {number.format(latestImport.row_count)} baris · {new Date(latestImport.imported_at).toLocaleString("id-ID")}
        </div>
      ) : null}

      <div className="product-filters">
        <label className="search-field">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari produk, variasi, atau SKU" />
        </label>
        <label>
          Dari
          <input type="date" value={date.from} onChange={(event) => setDate((current) => ({ ...current, from: event.target.value }))} />
        </label>
        <label>
          Sampai
          <input type="date" value={date.to} onChange={(event) => setDate((current) => ({ ...current, to: event.target.value }))} />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatusFilter)} aria-label="Filter status pesanan">
          <option value="all">Semua status</option>
          <option value="completed">Selesai</option>
          <option value="progress">Dalam proses</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
        <button className="btn btn-sm btn-ghost" type="button" onClick={() => { setDate({ from: "", to: "" }); setSearch(""); setStatusFilter("all"); }}>
          Reset
        </button>
      </div>

      <div className="product-kpis">
        <div className="product-kpi primary"><PackageCheck size={20} /><span>Terjual bersih<strong>{number.format(summary.netSold)}</strong></span></div>
        <div className="product-kpi"><RotateCcw size={20} /><span>Retur selesai<strong>{number.format(summary.returned)}</strong></span></div>
        <div className="product-kpi"><Truck size={20} /><span>Dalam proses<strong>{number.format(summary.shipped + summary.pending)}</strong></span></div>
        <div className="product-kpi"><span>Pesanan unik<strong>{number.format(summary.uniqueOrders)}</strong></span></div>
        <div className="product-kpi"><span>Produk / SKU<strong>{number.format(summary.uniqueProducts)} / {number.format(summary.uniqueSkus)}</strong></span></div>
      </div>

      {products.length ? (
        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Selesai</th>
                <th>Retur</th>
                <th>Terjual Bersih</th>
                <th>Dikirim</th>
                <th>Perlu Dikirim</th>
                <th>Dibatalkan</th>
              </tr>
            </thead>
            <tbody>
              {products.flatMap((product) => {
                const open = expanded.has(product.summary.key);
                const rows = [
                  <tr className="product-row" key={product.summary.key}>
                    <td>
                      <button className="product-name" type="button" onClick={() => toggle(product.summary.key)}>
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span>{product.summary.productName}<small>{product.variants.size} variasi/SKU</small></span>
                      </button>
                    </td>
                    <td>{number.format(product.summary.completed)}</td>
                    <td>{number.format(product.summary.returned)}</td>
                    <td className="net-cell">{number.format(product.summary.netSold)}</td>
                    <td>{number.format(product.summary.shipped)}</td>
                    <td>{number.format(product.summary.pending)}</td>
                    <td>{number.format(product.summary.cancelled)}</td>
                  </tr>
                ];
                if (open) {
                  product.variants.forEach((variant) => rows.push(
                    <tr className="variant-row" key={`${product.summary.key}-${variant.key}`}>
                      <td><span className="variant-name">{variant.variation || "Tanpa variasi"}<small>SKU {variant.skuId}</small></span></td>
                      <td>{number.format(variant.completed)}</td>
                      <td>{number.format(variant.returned)}</td>
                      <td className="net-cell">{number.format(variant.netSold)}</td>
                      <td>{number.format(variant.shipped)}</td>
                      <td>{number.format(variant.pending)}</td>
                      <td>{number.format(variant.cancelled)}</td>
                    </tr>
                  ));
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="product-empty">
          <PackageCheck size={34} />
          <h3>Belum ada data produk</h3>
          <p>Upload file “Semua pesanan” dari TikTok Shop untuk melihat rekap produk terjual.</p>
        </div>
      )}
    </section>
  );
}
