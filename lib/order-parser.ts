"use client";

import * as XLSX from "xlsx";
import type { OrderItem, ParsedOrderBatch } from "@/lib/types";

const REQUIRED_HEADERS = ["Order ID", "Order Status", "SKU ID", "Product Name", "Quantity", "Created Time"] as const;
const ORDER_SHEET = "orderskulist";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown) {
  const normalized = text(value).replace(/[^0-9.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeInteger(value: unknown) {
  const parsed = numberOrNull(value);
  if (parsed === null || parsed < 0 || !Number.isInteger(parsed)) return null;
  return parsed;
}

function parseTikTokDate(value: unknown) {
  const raw = text(value);
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (!match) return null;
  const [, day, month, year, hour = "00", minute = "00", second = "00"] = match;
  const yyyy = year;
  const mm = month.padStart(2, "0");
  const dd = day.padStart(2, "0");
  return {
    timestamp: `${yyyy}-${mm}-${dd} ${hour.padStart(2, "0")}:${minute}:${second}`,
    date: `${yyyy}-${mm}-${dd}`,
    month: `${yyyy}-${mm}`
  };
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function detectWorkbookType(buffer: ArrayBuffer): "orders" | "transactions" | "unknown" {
  const workbook = XLSX.read(buffer, { type: "array", bookSheets: true });
  if (workbook.SheetNames.some((name) => name.toLowerCase() === ORDER_SHEET)) return "orders";
  if (workbook.SheetNames.some((name) => /riwayat penarikan|withdraw/i.test(name))) return "transactions";
  return "unknown";
}

export async function parseOrderWorkbook(buffer: ArrayBuffer, filename: string): Promise<ParsedOrderBatch> {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === ORDER_SHEET);
  if (!sheetName) throw new Error(`Sheet "OrderSKUList" tidak ditemukan di ${filename}.`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: ""
  });
  const headerIndex = rows.findIndex((row) => REQUIRED_HEADERS.every((header) => row.some((cell) => text(cell) === header)));
  if (headerIndex < 0) throw new Error(`Header OrderSKUList tidak lengkap di ${filename}.`);

  const headers = rows[headerIndex].map(text);
  const column = (name: string) => headers.indexOf(name);
  const items: OrderItem[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const orderId = text(row[column("Order ID")]);
    if (!orderId) continue;
    // TikTok menaruh baris deskripsi tepat di bawah header.
    if (!/^\d+$/.test(orderId)) {
      skipped += 1;
      continue;
    }

    const skuId = text(row[column("SKU ID")]);
    const productName = text(row[column("Product Name")]);
    const quantity = nonNegativeInteger(row[column("Quantity")]);
    const returnedQuantity = nonNegativeInteger(row[column("Sku Quantity of return")]) ?? 0;
    const created = parseTikTokDate(row[column("Created Time")]);
    if (!skuId || !productName || quantity === null || !created) {
      skipped += 1;
      if (warnings.length < 8) warnings.push(`Baris ${index + 1} dilewati karena kolom wajib tidak valid.`);
      continue;
    }

    const variation = text(row[column("Variation")]);
    const dedupeKey = `${orderId}|${skuId}|${variation}`;
    if (seen.has(dedupeKey)) {
      skipped += 1;
      if (warnings.length < 8) warnings.push(`Baris ${index + 1} merupakan duplikat dalam file.`);
      continue;
    }
    seen.add(dedupeKey);

    items.push({
      order_id: orderId,
      sku_id: skuId,
      seller_sku: text(row[column("Seller SKU")]),
      product_name: productName,
      variation,
      quantity,
      returned_quantity: returnedQuantity,
      order_status: text(row[column("Order Status")]),
      order_substatus: text(row[column("Order Substatus")]),
      order_created_at: created.timestamp,
      order_date: created.date,
      month_key: created.month,
      unit_original_price: numberOrNull(row[column("SKU Unit Original Price")]),
      sku_subtotal_after_discount: numberOrNull(row[column("SKU Subtotal After Discount")]),
      source_file: filename,
      source_row: index + 1,
      dedupe_key: dedupeKey
    });
  }

  if (!items.length) throw new Error(`Tidak ada baris pesanan valid di ${filename}.`);
  return { fileName: filename, fileHash: await sha256(buffer), items, skipped, warnings };
}
