"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { granName, groupByPeriod, periodLabel, summarize } from "@/lib/calculations";
import { splitCashPool } from "@/lib/cash-sharing";
import { exportImage, printSection } from "@/lib/export";
import { fmt, fmtSigned } from "@/lib/format";
import type { Granularity, Transaction } from "@/lib/types";

type Props = {
  transactions: Transaction[];
  granularity: Granularity;
  splitYou: number;
  splitSupplier: number;
  setStatus: (value: string, kind?: "ok" | "err") => void;
};

function transactionLabel(type: Transaction["type"]) {
  if (type === "Withdrawal") return "Dana masuk rekening";
  if (type === "GMV Pay Deduction") return "Biaya promosi marketplace";
  return "Pendapatan marketplace";
}

export default function LedgerView({ transactions, granularity, splitYou, splitSupplier, setStatus }: Props) {
  const grouped = useMemo(() => groupByPeriod(granularity, transactions), [transactions, granularity]);
  const keys = Object.keys(grouped).sort().reverse();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const currentKey = activeKey && grouped[activeKey] ? activeKey : keys[0];

  if (!keys.length) {
    return (
      <section className="ledger">
        <div className="tabs">
          <div className="tabs-empty">Belum ada data.<br />Upload laporan untuk mulai.</div>
        </div>
        <div className="page">
          <div className="page-empty">
            <h3>Belum ada rekap bagi hasil</h3>
            <p>Upload laporan penarikan TikTok Shop untuk melihat pembagian dana di sini.</p>
          </div>
        </div>
      </section>
    );
  }

  const list = grouped[currentKey].slice().sort((a, b) => a.date_raw.localeCompare(b.date_raw));
  const summary = summarize(list);
  const shares = splitCashPool(summary.gross, splitYou);

  return (
    <section className="ledger">
      <div className="tabs">
        {keys.map((key) => {
          const tabSummary = summarize(grouped[key]);
          return (
            <button key={key} className={`tab ${key === currentKey ? "active" : ""}`} type="button" onClick={() => setActiveKey(key)}>
              <span className="m">{periodLabel(key, granularity, grouped[key])}</span>
              <span className="g">{fmt(tabSummary.gross)}</span>
            </button>
          );
        })}
      </div>

      <div className="page" ref={pageRef}>
        <div className="page-head">
          <div>
            <h2>{periodLabel(currentKey, granularity, list)}</h2>
            <div className="sub">{list.length} transaksi tercatat · tampilan {granName(granularity).toLowerCase()}</div>
          </div>
          <div className="page-head-right">
            <div className="stamp">
              Dana Bersih Siap Dibagi<br />{fmt(summary.gross)}
              <small>Dana Masuk Rekening - Biaya Marketing GMV Pay</small>
            </div>
            <div className="card-tools">
              <button className="icon-btn" type="button" title="Cetak / simpan sebagai PDF" onClick={() => printSection(pageRef.current, `rekap-${currentKey}`)}>
                <Printer size={15} />
              </button>
              <button
                className="icon-btn"
                type="button"
                title="Unduh sebagai JPEG"
                onClick={() => exportImage(pageRef.current, `rekap-${currentKey}.jpg`, "#ffffff").catch(() => setStatus("Gagal membuat file JPEG.", "err"))}
              >
                <Download size={15} />
              </button>
            </div>
          </div>
        </div>

        <table className="rows">
          <tbody>
            <tr>
              <td className="rlabel">Dana Masuk Rekening</td>
              <td className="ramt pos">{fmtSigned(summary.withdrawal)}</td>
            </tr>
            <tr>
              <td className="rlabel">Biaya Marketing GMV Pay</td>
              <td className="ramt neg">{fmtSigned(-summary.gmv)}</td>
            </tr>
            <tr>
              <td className="rlabel">Pendapatan Tercatat di Marketplace</td>
              <td className="ramt pos">{fmtSigned(summary.earnings)}</td>
            </tr>
            <tr className="total">
              <td>Dana Bersih Siap Dibagi</td>
              <td className="ramt">{fmt(summary.gross)}</td>
            </tr>
          </tbody>
        </table>

        <div className="split-grid">
          <div className="split-card you">
            <div className="pct">BAGIAN ANDA · {splitYou}%</div>
            <div className="amt">{fmt(shares.yourShare)}</div>
          </div>
          <div className="split-card supplier">
            <div className="pct">BAGIAN SUPPLIER + MODAL · {splitSupplier}%</div>
            <div className="amt">{fmt(shares.supplierShare)}</div>
          </div>
        </div>

        <details>
          <summary>Lihat rincian {list.length} catatan dana</summary>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Keterangan</th>
                <th style={{ textAlign: "right" }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {list.map((transaction) => (
                <tr key={transaction.dedupe_key}>
                  <td>{transaction.date_raw}</td>
                  <td>
                    <span className={`badge ${transaction.type === "Withdrawal" ? "wd" : transaction.type === "GMV Pay Deduction" ? "gmv" : "earn"}`}>{transactionLabel(transaction.type)}</span>
                  </td>
                  <td className={`amt ${transaction.amount < 0 ? "neg" : "pos"}`}>{fmtSigned(transaction.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}
