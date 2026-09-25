"use client";

import * as XLSX from "xlsx";
import type { FinancialComponent, FinancialEntry, ParsedFinancialBatch } from "@/lib/types";

function text(value: unknown) {
  return String(value ?? "").replace(/\t/g, "").trim();
}

function number(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = text(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function date(value: unknown) {
  const match = text(value).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : null;
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function summaryValue(rows: unknown[][], label: string) {
  const row = rows.find((candidate) => candidate.some((cell) => text(cell) === label));
  if (!row) return null;
  const values = row.map(number);
  const last = values.findLastIndex((value, index) => text(row[index]) !== "" && Number.isFinite(value));
  return last >= 0 ? values[last] : null;
}

export async function parseFinancialWorkbook(buffer: ArrayBuffer, filename: string): Promise<ParsedFinancialBatch> {
  const workbook = XLSX.read(buffer, { type: "array", raw: true });
  const detailName = workbook.SheetNames.find((name) => name.toLowerCase().includes("detail pesanan"));
  if (!detailName) throw new Error(`Sheet "Detail pesanan" tidak ditemukan di ${filename}.`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[detailName], { header: 1, raw: true, defval: "" });
  const headerIndex = rows.findIndex((row) => row.some((cell) => text(cell) === "ID Pesanan/Penyesuaian"));
  if (headerIndex < 0) throw new Error(`Header detail keuangan tidak ditemukan di ${filename}.`);
  const headers = rows[headerIndex].map(text);
  const column = (name: string) => headers.indexOf(name);
  const required = ["ID Pesanan/Penyesuaian", "Jenis transaksi", "Jumlah penyelesaian pembayaran", "Total Pendapatan", "Total Biaya"];
  if (required.some((name) => column(name) < 0)) throw new Error(`Kolom wajib detail keuangan tidak lengkap di ${filename}.`);

  const feeStart = column("Biaya komisi platform");
  const adjustmentIndex = column("Jumlah penyesuaian");
  const trailingFees = new Set(["Biaya komisi sebelum diskon", "Diskon (dari belanja iklan)", "Diskon komisi lainnya"]);
  const entries: FinancialEntry[] = [];
  const seen = new Set<string>();
  const warnings: string[] = [];

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const transactionId = text(row[column("ID Pesanan/Penyesuaian")]);
    const transactionType = text(row[column("Jenis transaksi")]);
    if (!transactionId || !transactionType) continue;
    const dedupeKey = `${transactionId}|${transactionType}`;
    if (seen.has(dedupeKey)) {
      warnings.push(`Baris ${index + 1} duplikat dan dilewati.`);
      continue;
    }
    seen.add(dedupeKey);

    const components: FinancialComponent[] = [];
    headers.forEach((label, columnIndex) => {
      const isFeeColumn = feeStart >= 0 && adjustmentIndex > feeStart && columnIndex >= feeStart && columnIndex < adjustmentIndex;
      if ((!isFeeColumn && !trailingFees.has(label)) || !label) return;
      const amount = number(row[columnIndex]);
      if (!amount) return;
      components.push({ code: `${slug(label) || "component"}_${columnIndex}`, label, column_index: columnIndex, amount });
    });

    entries.push({
      transaction_id: transactionId,
      transaction_type: transactionType,
      order_date: date(row[column("Waktu pemesanan")]),
      payment_date: date(row[column("Waktu pembayaran pesanan")]),
      currency: text(row[column("Mata uang")]) || "IDR",
      settlement_amount: number(row[column("Jumlah penyelesaian pembayaran")]),
      total_revenue: number(row[column("Total Pendapatan")]),
      total_fees: number(row[column("Total Biaya")]),
      adjustment_amount: number(row[column("Jumlah penyesuaian")]),
      related_order_id: text(row[column("ID pesanan terkait")]).replace(/^\/$/, "") || null,
      buyer_payment: number(row[column("Pembayaran oleh pembeli")]),
      platform_discount: number(row[column("Diskon platform")]),
      seller_discount: number(row[column("Diskon penjual")]),
      product_detail: text(row[column("Detail produk terjual")]),
      source_row: index + 1,
      dedupe_key: dedupeKey,
      components
    });
  }
  if (!entries.length) throw new Error(`Tidak ada transaksi detail keuangan yang valid di ${filename}.`);

  const reportName = workbook.SheetNames.find((name) => name.toLowerCase() === "laporan");
  const reportRows = reportName
    ? XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[reportName], { header: 1, raw: true, defval: "" })
    : [];
  const periodText = reportRows.length ? text(reportRows.find((row) => row.some((cell) => text(cell) === "Periode"))?.at(-1)) : "";
  const periodMatch = periodText.match(/(\d{4}\/\d{2}\/\d{2})-(\d{4}\/\d{2}\/\d{2})/);
  const summarySettlement = summaryValue(reportRows, "Jumlah penyelesaian pembayaran");
  const summaryRevenue = summaryValue(reportRows, "Total Pendapatan");
  const summaryFees = summaryValue(reportRows, "Total Biaya");
  const summaryAdjustments = summaryValue(reportRows, "Jumlah penyesuaian");
  const detailSettlement = entries.reduce((sum, entry) => sum + entry.settlement_amount, 0);
  const reconciliationDifference = summarySettlement === null ? null : summarySettlement - detailSettlement;
  if (reconciliationDifference) warnings.push(`Detail berbeda ${reconciliationDifference.toLocaleString("id-ID")} dari ringkasan laporan.`);

  return {
    fileName: filename,
    fileHash: await sha256(buffer),
    periodStart: periodMatch ? date(periodMatch[1]) : null,
    periodEnd: periodMatch ? date(periodMatch[2]) : null,
    currency: entries[0]?.currency || "IDR",
    summarySettlement,
    summaryRevenue,
    summaryFees,
    summaryAdjustments,
    detailSettlement,
    reconciliationDifference,
    entries,
    warnings: warnings.slice(0, 12)
  };
}
