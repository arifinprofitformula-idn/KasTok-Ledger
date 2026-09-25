import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseFinancialWorkbook } from "../lib/financial-parser.ts";

test("financial parser reads order economics, duplicate fee headers, and reconciliation", async () => {
  const workbook = XLSX.utils.book_new();
  const detail = [
    ["ID Pesanan/Penyesuaian", "Jenis transaksi", "Waktu pemesanan", "Waktu pembayaran pesanan", "Mata uang", "Jumlah penyelesaian pembayaran", "Total Pendapatan", "Subtotal setelah diskon penjual", "Subtotal sebelum diskon", "Diskon penjual", "Total Biaya", "Biaya komisi platform", "Ongkir yang ditanggung platform", "", "Jumlah penyesuaian", "ID pesanan terkait", "Pembayaran oleh pembeli", "Diskon platform", "Ongkir yang ditanggung platform", "Detail produk terjual", "Biaya komisi sebelum diskon", "Diskon (dari belanja iklan)", "Diskon komisi lainnya"],
    ["100", "Pesanan", "2026/09/01", "2026/09/01", "IDR", 80, 100, 90, 100, -10, -20, -15, 5, "", 0, "/", 100, 10, 3, "SKU*1", -25, 5, 0]
  ];
  const report = [
    ["", "Periode", "", "2026/09/01-2026/09/30"],
    ["", "Jumlah penyelesaian pembayaran", "", 100],
    ["", "Total Pendapatan", "", 120],
    ["", "Total Biaya", "", -20],
    ["", "Jumlah penyesuaian", "", 0]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(detail), "Detail pesanan");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(report), "Laporan");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const parsed = await parseFinancialWorkbook(bytes, "income.xlsx");
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].transaction_id, "100");
  assert.equal(parsed.entries[0].total_fees, -20);
  assert.equal(parsed.entries[0].components.length, 4);
  assert.equal(new Set(parsed.entries[0].components.map((item) => item.code)).size, 4);
  assert.equal(parsed.summarySettlement, 100);
  assert.equal(parsed.detailSettlement, 80);
  assert.equal(parsed.reconciliationDifference, 20);
});
