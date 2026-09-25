"use client";

import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { groupByPeriod, summarize } from "@/lib/calculations";
import { splitCashPool } from "@/lib/cash-sharing";
import { aggregateProductSales, summarizeOrderItems } from "@/lib/order-calculations";
import type { BusinessReport } from "@/lib/business-calculations";
import { monthLabel } from "@/lib/format";
import type { FinancialEntry, FinancialImport, OrderItem, Transaction } from "@/lib/types";

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

export function exportProductSalesRecap(items: OrderItem[]) {
  if (!items.length) throw new Error("Belum ada data produk untuk diekspor.");
  const summary = summarizeOrderItems(items);
  const products = aggregateProductSales(items);
  const workbook = XLSX.utils.book_new();

  const summaryRows: (string | number)[][] = [
    ["REKAP PRODUK TERJUAL"],
    ["Diekspor", new Date().toLocaleString("id-ID")],
    [],
    ["Metrik", "Nilai"],
    ["Unit selesai", summary.completed],
    ["Unit retur", summary.returned],
    ["Unit terjual bersih", summary.netSold],
    ["Unit dikirim", summary.shipped],
    ["Unit perlu dikirim", summary.pending],
    ["Unit dibatalkan", summary.cancelled],
    ["Pesanan unik", summary.uniqueOrders],
    ["Produk unik", summary.uniqueProducts],
    ["SKU unik", summary.uniqueSkus]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

  const productRows: (string | number)[][] = [["Produk", "SKU ID", "Variasi", "Qty Selesai", "Qty Retur", "Terjual Bersih", "Dikirim", "Perlu Dikirim", "Dibatalkan"]];
  products.forEach((product) => {
    productRows.push([product.summary.productName, "SEMUA SKU", "", product.summary.completed, product.summary.returned, product.summary.netSold, product.summary.shipped, product.summary.pending, product.summary.cancelled]);
    product.variants.forEach((variant) => {
      productRows.push([variant.productName, variant.skuId, variant.variation, variant.completed, variant.returned, variant.netSold, variant.shipped, variant.pending, variant.cancelled]);
    });
  });
  const productSheet = XLSX.utils.aoa_to_sheet(productRows);
  productSheet["!cols"] = [{ wch: 56 }, { wch: 22 }, { wch: 36 }, ...Array.from({ length: 6 }, () => ({ wch: 16 }))];
  productSheet["!autofilter"] = { ref: `A1:I${productRows.length}` };
  XLSX.utils.book_append_sheet(workbook, productSheet, "Produk Terjual");

  const detailRows: (string | number | null)[][] = [["Tanggal", "Order ID", "Status", "SKU ID", "Seller SKU", "Produk", "Variasi", "Quantity", "Retur", "Terjual Bersih", "Harga Unit", "Subtotal Setelah Diskon", "Sumber"]];
  items
    .slice()
    .sort((a, b) => a.order_created_at.localeCompare(b.order_created_at))
    .forEach((item) => {
      detailRows.push([
        item.order_created_at,
        item.order_id,
        item.order_status,
        item.sku_id,
        item.seller_sku,
        item.product_name,
        item.variation,
        item.quantity,
        item.returned_quantity,
        item.order_status.toLocaleLowerCase("id-ID") === "selesai" ? Math.max(item.quantity - item.returned_quantity, 0) : 0,
        item.unit_original_price,
        item.sku_subtotal_after_discount,
        item.source_file
      ]);
    });
  const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
  detailSheet["!cols"] = [{ wch: 21 }, { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 56 }, { wch: 36 }, ...Array.from({ length: 6 }, () => ({ wch: 18 }))];
  detailSheet["!autofilter"] = { ref: `A1:M${detailRows.length}` };
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Detail Pesanan");

  XLSX.writeFile(workbook, `rekap-produk-terjual-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportBusinessReport(report: BusinessReport, entries: FinancialEntry[], latest?: FinancialImport) {
  if (!entries.length) throw new Error("Belum ada detail keuangan untuk diekspor.");
  const workbook = XLSX.utils.book_new();
  const summaryRows: (string | number)[][] = [
    ["LAPORAN PROFITABILITAS BISNIS"],
    ["Diekspor", new Date().toLocaleString("id-ID")],
    ["Sumber terakhir", latest?.file_name || "-"],
    ["Periode", latest ? `${String(latest.period_start || "-").slice(0, 10)} s.d. ${String(latest.period_end || "-").slice(0, 10)}` : "-"],
    [],
    ["Metrik", "Nilai"],
    ["Pendapatan diakui", report.recognizedRevenue],
    ["Biaya marketplace", report.marketplaceFees],
    ["Diskon penjual", report.sellerDiscount],
    ["Diskon platform", report.platformDiscount],
    ["HPP tercatat", report.hpp],
    ["Laba kotor", report.grossProfit],
    ["Laba kontribusi", report.contributionProfit],
    ["Margin kontribusi", report.contributionMargin ?? 0],
    ["Penyelesaian bersih", report.settlement],
    ["Pesanan terhubung", report.linkedOrders],
    ["Unit belum memiliki HPP", report.missingCostUnits],
    ["Status laba", report.missingCostUnits ? "SEMENTARA - HPP belum lengkap" : "FINAL berdasarkan data saat ekspor"],
    ["Selisih rekonsiliasi sumber", latest?.reconciliation_difference || 0]
  ];
  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  summary["!cols"] = [{ wch: 34 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, summary, "Ringkasan");

  const productRows: (string | number)[][] = [["Produk", "SKU ID", "Variasi", "Qty", "Pendapatan", "Diskon Platform", "Biaya Marketplace", "HPP", "Laba Kontribusi", "Margin", "Unit Tanpa HPP", "Jumlah Pesanan"]];
  report.rows.forEach((row) => productRows.push([row.productName, row.skuId, row.variation, row.quantity, row.revenue, row.platformDiscount, row.marketplaceFees, row.hpp, row.contribution, row.margin ?? 0, row.missingCostUnits, row.orders]));
  const products = XLSX.utils.aoa_to_sheet(productRows);
  products["!cols"] = [{ wch: 52 }, { wch: 22 }, { wch: 34 }, ...Array.from({ length: 9 }, () => ({ wch: 18 }))];
  products["!autofilter"] = { ref: `A1:L${productRows.length}` };
  XLSX.utils.book_append_sheet(workbook, products, "Margin Produk");

  const financeRows: (string | number | null)[][] = [["Tanggal", "ID Pesanan/Penyesuaian", "Jenis Transaksi", "ID Pesanan Terkait", "Pendapatan", "Biaya", "Penyesuaian", "Penyelesaian", "Sumber Baris"]];
  entries.forEach((entry) => financeRows.push([entry.order_date, entry.transaction_id, entry.transaction_type, entry.related_order_id, entry.total_revenue, entry.total_fees, entry.adjustment_amount, entry.settlement_amount, entry.source_row]));
  const finance = XLSX.utils.aoa_to_sheet(financeRows);
  finance["!cols"] = [{ wch: 14 }, { wch: 25 }, { wch: 50 }, { wch: 25 }, ...Array.from({ length: 5 }, () => ({ wch: 18 }))];
  finance["!autofilter"] = { ref: `A1:I${financeRows.length}` };
  XLSX.utils.book_append_sheet(workbook, finance, "Detail Keuangan");
  XLSX.writeFile(workbook, `laporan-profitabilitas-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
