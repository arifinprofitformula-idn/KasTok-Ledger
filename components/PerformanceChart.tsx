"use client";

import { useMemo, useRef } from "react";
import {
  BarElement,
  BarController,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { Download, Printer } from "lucide-react";
import { availableMonths, granName, groupByPeriod, periodLabel, summarize } from "@/lib/calculations";
import { fmt, fmtShort, monthLabel } from "@/lib/format";
import { exportImage, printSection } from "@/lib/export";
import type { Granularity, Transaction } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, BarController, LineController, BarElement, LineElement, PointElement, Tooltip, Legend);

type Props = {
  transactions: Transaction[];
  granularity: Granularity;
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
  setStatus: (value: string, kind?: "ok" | "err") => void;
};

export default function PerformanceChart({ transactions, granularity, selectedMonth, setSelectedMonth, setStatus }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const months = useMemo(() => availableMonths(transactions), [transactions]);
  const chartTransactions = selectedMonth === "all" ? transactions : transactions.filter((item) => item.month_key === selectedMonth);
  const grouped = groupByPeriod(granularity, chartTransactions);
  const keys = Object.keys(grouped).sort();
  const grossSeries = keys.map((key) => summarize(grouped[key]).gross);
  let cumulative = 0;
  const cumulativeSeries = grossSeries.map((value) => (cumulative += value));
  const peak = grossSeries.length ? Math.max(...grossSeries) : 0;
  const avg = grossSeries.length ? grossSeries.reduce((sum, value) => sum + value, 0) / grossSeries.length : 0;
  const last = grossSeries[grossSeries.length - 1];
  const prev = grossSeries.length > 1 ? grossSeries[grossSeries.length - 2] : null;
  const delta = prev !== null && prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : null;
  const monthPart = selectedMonth === "all" ? "SEMUA BULAN" : monthLabel(selectedMonth).toUpperCase();

  const data = {
    labels: keys.map((key) => periodLabel(key, granularity, grouped[key])),
    datasets: [
      {
        type: "bar" as const,
        label: "Dana Bersih Siap Dibagi per periode",
        data: grossSeries,
        backgroundColor: "rgba(76, 242, 224, 0.72)",
        borderColor: "rgba(76, 242, 224, 0.95)",
        borderWidth: 1,
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 46,
        order: 2
      },
      {
        type: "line" as const,
        label: "Akumulasi",
        data: cumulativeSeries,
        borderColor: "#F2B84C",
        backgroundColor: "#F2B84C",
        borderWidth: 2.2,
        pointRadius: 3,
        pointBackgroundColor: "#F2B84C",
        pointBorderColor: "#060B14",
        pointBorderWidth: 1.5,
        tension: 0.35,
        yAxisID: "y1",
        order: 1
      }
    ]
  };

  return (
    <section className="chart-panel" ref={panelRef}>
      <div className="chart-head">
        <div>
          <h2>Grafik Pencapaian</h2>
          <div className="sub">
            TREN DANA BERSIH SIAP DIBAGI · TAMPILAN {granName(granularity).toUpperCase()} · {monthPart}
          </div>
        </div>
        <div className="page-head-right">
          <select className="month-select" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} title="Tampilkan bulan tertentu">
            <option value="all">Semua Bulan</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
          <span className={`trend-badge ${delta === null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`}>
            {delta === null ? "- data belum cukup untuk tren" : `${delta >= 0 ? "Naik" : "Turun"} ${Math.abs(delta).toFixed(1)}% vs periode sebelumnya`}
          </span>
          <div className="card-tools">
            <button className="icon-btn on-dark" type="button" title="Cetak / simpan sebagai PDF" onClick={() => printSection(panelRef.current, "Grafik Pencapaian")}>
              <Printer size={15} />
            </button>
            <button
              className="icon-btn on-dark"
              type="button"
              title="Unduh sebagai JPEG"
              onClick={() => exportImage(panelRef.current, `grafik-pencapaian-${granularity}.jpg`, "#060B14").catch(() => setStatus("Gagal membuat file JPEG.", "err"))}
            >
              <Download size={15} />
            </button>
          </div>
        </div>
      </div>

      {keys.length ? (
        <>
          <div className="chart-stats">
            <div className="chart-stat">
              <div className="l">Puncak</div>
              <div className="v">{fmt(peak)}</div>
            </div>
            <div className="chart-stat">
              <div className="l">Rata-rata</div>
              <div className="v">{fmt(avg)}</div>
            </div>
            <div className="chart-stat">
              <div className="l">Akumulasi</div>
              <div className="v">{fmt(cumulative)}</div>
            </div>
          </div>
          <div className="chart-wrap">
            <Chart
              type="bar"
              data={data}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { labels: { color: "#C9D8E6", font: { family: "monospace", size: 11 }, boxWidth: 12, usePointStyle: true } },
                  tooltip: {
                    backgroundColor: "#0E1D2E",
                    borderColor: "#16273A",
                    borderWidth: 1,
                    padding: 10,
                    callbacks: { label: (context) => ` ${context.dataset.label}: ${fmt(Number(context.parsed.y))}` }
                  }
                },
                scales: {
                  x: { ticks: { color: "#7F94A8", font: { family: "monospace", size: 10.5 }, maxRotation: 0, autoSkipPadding: 12 }, grid: { color: "rgba(22,39,58,0.6)" } },
                  y: { ticks: { color: "#7F94A8", font: { family: "monospace", size: 10.5 }, callback: (value) => fmtShort(Number(value)) }, grid: { color: "rgba(22,39,58,0.6)" } },
                  y1: { position: "right", ticks: { color: "#7F94A8", font: { family: "monospace", size: 10.5 }, callback: (value) => fmtShort(Number(value)) }, grid: { drawOnChartArea: false } }
                }
              }}
            />
          </div>
        </>
      ) : (
        <div className="chart-empty">Belum ada data untuk ditampilkan. Upload laporan terlebih dahulu.</div>
      )}
    </section>
  );
}
