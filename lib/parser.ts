"use client";

import * as XLSX from "xlsx";
import type { Transaction, TransactionType } from "@/lib/types";

const validTypes: TransactionType[] = ["Withdrawal", "GMV Pay Deduction", "Earnings"];

function fixSheetRange(ws: XLSX.WorkSheet) {
  let maxRow = 0;
  let maxCol = 0;
  let found = false;

  Object.keys(ws).forEach((key) => {
    if (key[0] === "!") return;
    const cell = ws[key];
    if (!cell || cell.v === undefined || cell.v === null || cell.v === "") return;
    const addr = XLSX.utils.decode_cell(key);
    maxRow = Math.max(maxRow, addr.r);
    maxCol = Math.max(maxCol, addr.c);
    found = true;
  });

  if (found) {
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
  }
}

function normalizeAmount(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  return Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
}

function parseDate(dateRaw: string) {
  const match = dateRaw.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (!match) return { transaction_date: null, month_key: "Tidak diketahui" };
  return {
    transaction_date: `${match[1]}-${match[2]}-${match[3]}`,
    month_key: `${match[1]}-${match[2]}`
  };
}

export function parseWorkbook(buffer: ArrayBuffer, filename: string, existingKeys: Set<string>) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase().includes("riwayat penarikan")) ||
    workbook.SheetNames.find((name) => name.toLowerCase().includes("withdraw"));

  if (!sheetName) {
    return { transactions: [] as Transaction[], skipped: 0, error: `Sheet "Riwayat penarikan" tidak ditemukan di ${filename}` };
  }

  const ws = workbook.Sheets[sheetName];
  fixSheetRange(ws);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  if (!rows.length) return { transactions: [] as Transaction[], skipped: 0, error: `Sheet kosong di ${filename}` };

  const headerIdx = Math.max(
    0,
    rows.findIndex((row) => (row || []).some((cell) => String(cell || "").toLowerCase().includes("jenis transaksi")))
  );

  const parsed: Transaction[] = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const type = String(row[0]).trim() as TransactionType;
    if (!validTypes.includes(type)) continue;

    const reference_id = String(row[1] || "").trim() || null;
    const date_raw = String(row[2] || "").trim();
    const amount = normalizeAmount(row[3]);
    if (!Number.isFinite(amount)) continue;

    const dedupe_key = reference_id || `${type}|${date_raw}|${amount}|${i}`;
    if (existingKeys.has(dedupe_key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(dedupe_key);

    const date = parseDate(date_raw);
    parsed.push({
      reference_id,
      dedupe_key,
      type,
      date_raw,
      transaction_date: date.transaction_date,
      month_key: date.month_key,
      amount,
      source_file: filename
    });
  }

  return { transactions: parsed, skipped, error: null };
}

export async function parseFiles(files: File[], existingKeys: Set<string>) {
  const all: Transaction[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer();
      const result = parseWorkbook(buffer, file.name, existingKeys);
      all.push(...result.transactions);
      skipped += result.skipped;
      if (result.error) errors.push(result.error);
    } catch (error) {
      errors.push(`Gagal membaca ${file.name}: ${error instanceof Error ? error.message : "error tidak diketahui"}`);
    }
  }

  return { transactions: all, skipped, errors };
}
