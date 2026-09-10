"use client";

import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { groupByPeriod, summarize } from "@/lib/calculations";
import { splitCashPool } from "@/lib/cash-sharing";
import { monthLabel } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export function exportImage(element: HTMLElement | null, filename: string, backgroundColor?: string) {
  if (!element) return Promise.reject(new Error("Elemen tidak ditemukan."));
  return html2canvas(element, { backgroundColor: backgroundColor || null, scale: 2, useCORS: true }).then((canvas) => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  });
}

export function printSection(element: HTMLElement | null, title: string) {
  if (!element) return;
  const printArea = document.getElementById("printArea");
  if (!printArea) return;
  printArea.innerHTML = "";

  const clone = element.cloneNode(true) as HTMLElement;
  const sourceCanvases = element.querySelectorAll("canvas");
  const cloneCanvases = clone.querySelectorAll("canvas");
  sourceCanvases.forEach((canvas, index) => {
    const image = document.createElement("img");
    image.src = canvas.toDataURL("image/png");
    image.style.width = "100%";
    cloneCanvases[index]?.replaceWith(image);
  });

  const meta = document.createElement("div");
  meta.style.cssText = "font-family:monospace;font-size:11px;color:#777;margin-bottom:10px;";
  meta.textContent = `${title} - dicetak ${new Date().toLocaleString("id-ID")}`;
  printArea.appendChild(meta);
  printArea.appendChild(clone);

  document.body.classList.add("printing");
  window.print();
}

export function clearPrintArea() {
  document.body.classList.remove("printing");
  const printArea = document.getElementById("printArea");
  if (printArea) printArea.innerHTML = "";
}

export function exportMonthlyRecap(transactions: Transaction[], splitYou: number, splitSupplier: number) {
  const grouped = groupByPeriod("month", transactions);
  const keys = Object.keys(grouped).sort();
  if (!keys.length) throw new Error("Belum ada data untuk diekspor.");

  const header = [
    "Bulan",
    "Dana Masuk Rekening",
    "Biaya Marketing GMV Pay",
    "Pendapatan Tercatat Marketplace",
    "Dana Bersih Siap Dibagi",
    `Bagian Anda (${splitYou}%)`,
    `Bagian Supplier + HPP (${splitSupplier}%)`
  ];
  const rows: (string | number)[][] = [header];
  let totalWithdrawal = 0;
  let totalGmv = 0;
  let totalEarnings = 0;
  let totalCashPool = 0;
  let totalYourShare = 0;
  let totalSupplierShare = 0;

  keys.forEach((key) => {
    const summary = summarize(grouped[key]);
    const shares = splitCashPool(summary.gross, splitYou);
    totalWithdrawal += summary.withdrawal;
    totalGmv += summary.gmv;
    totalEarnings += summary.earnings;
    totalCashPool += shares.cashPool;
    totalYourShare += shares.yourShare;
    totalSupplierShare += shares.supplierShare;
    rows.push([
      monthLabel(key),
      summary.withdrawal,
      summary.gmv,
      summary.earnings,
      shares.cashPool,
      shares.yourShare,
      shares.supplierShare
    ]);
  });

  rows.push(["TOTAL", totalWithdrawal, totalGmv, totalEarnings, totalCashPool, totalYourShare, totalSupplierShare]);

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = header.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(workbook, ws, "Rekap Bulanan");

  const detailHeader = ["Bulan", "Tanggal", "Jenis Transaksi", "Nominal"];
  const detailRows: (string | number)[][] = [detailHeader];
  transactions
    .slice()
    .sort((a, b) => a.date_raw.localeCompare(b.date_raw))
    .forEach((transaction) => {
      detailRows.push([monthLabel(transaction.month_key), transaction.date_raw, transaction.type, transaction.amount]);
    });
  const detailWs = XLSX.utils.aoa_to_sheet(detailRows);
  detailWs["!cols"] = detailHeader.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(workbook, detailWs, "Detail Transaksi");

  XLSX.writeFile(workbook, `rekap-tiktok-shop-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
