import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPool, query } from "@/lib/db";
import type { FinancialComponent, FinancialEntry, FinancialImport } from "@/lib/types";

const MAX_ENTRIES = 10_000;

function validText(value: unknown, max: number, required = false) {
  return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
}

function validNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function validDate(value: unknown) {
  return value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isValidEntry(entry: Partial<FinancialEntry>) {
  return Boolean(
    validText(entry.transaction_id, 100, true) &&
      validText(entry.transaction_type, 200, true) &&
      validDate(entry.order_date) && validDate(entry.payment_date) &&
      validText(entry.currency, 10, true) &&
      [entry.settlement_amount, entry.total_revenue, entry.total_fees, entry.adjustment_amount,
        entry.buyer_payment, entry.platform_discount, entry.seller_discount].every(validNumber) &&
      validText(entry.product_detail, 3000) &&
      Number.isInteger(entry.source_row) && Number(entry.source_row) > 0 &&
      validText(entry.dedupe_key, 500, true) &&
      Array.isArray(entry.components) && entry.components.length <= 150 &&
      entry.components.every((component) =>
        validText(component.code, 240, true) && validText(component.label, 500, true) &&
        Number.isInteger(component.column_index) && validNumber(component.amount)
      )
  );
}

function numeric<T extends Record<string, unknown>>(row: T, keys: string[]) {
  const copy: Record<string, unknown> = { ...row };
  keys.forEach((key) => {
    if (copy[key] !== null && copy[key] !== undefined) copy[key] = Number(copy[key]);
  });
  return copy as T;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi login sudah berakhir. Silakan login ulang." }, { status: 401 });
  try {
    const [imports, entries, components] = await Promise.all([
      query<FinancialImport>(
        `select id, file_name, file_hash, period_start, period_end, currency, summary_settlement,
                summary_revenue, summary_fees, summary_adjustments, detail_settlement,
                reconciliation_difference, row_count, imported_at
         from finance_imports where user_id = $1 order by imported_at desc limit 30`, [user.id]
      ),
      query<FinancialEntry>(
        `select id, import_id, transaction_id, transaction_type, order_date, payment_date, currency,
                settlement_amount, total_revenue, total_fees, adjustment_amount, related_order_id,
                buyer_payment, platform_discount, seller_discount, product_detail, source_row, dedupe_key
         from finance_entries where user_id = $1 order by coalesce(order_date, payment_date) desc, source_row`, [user.id]
      ),
      query<FinancialComponent & { finance_entry_id: string }>(
        `select fc.id, fc.finance_entry_id, fc.code, fc.label, fc.column_index, fc.amount
         from finance_components fc join finance_entries fe on fe.id = fc.finance_entry_id
         where fe.user_id = $1 order by fc.column_index`, [user.id]
      )
    ]);
    const byEntry = new Map<string, FinancialComponent[]>();
    components.rows.forEach((row) => {
      const item = numeric(row, ["column_index", "amount"]);
      const list = byEntry.get(row.finance_entry_id) || [];
      list.push(item);
      byEntry.set(row.finance_entry_id, list);
    });
    return NextResponse.json({
      imports: imports.rows.map((row) => numeric(row, ["summary_settlement", "summary_revenue", "summary_fees", "summary_adjustments", "detail_settlement", "reconciliation_difference", "row_count"])),
      entries: entries.rows.map((row) => ({
        ...numeric(row, ["settlement_amount", "total_revenue", "total_fees", "adjustment_amount", "buyer_payment", "platform_discount", "seller_discount", "source_row"]),
        components: byEntry.get(row.id || "") || []
      }))
    });
  } catch (error) {
    console.error("Finance data load failed", error);
    return NextResponse.json({ error: "Penyimpanan laporan pembayaran belum siap. Periksa pengaturan aplikasi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesi login sudah berakhir. Silakan login ulang." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const entries = Array.isArray(body?.entries) ? body.entries as Partial<FinancialEntry>[] : [];
  if (!validText(body?.fileName, 500, true) || !/^[a-f0-9]{64}$/.test(body?.fileHash || "") ||
      !entries.length || entries.length > MAX_ENTRIES || entries.some((entry) => !isValidEntry(entry)) ||
      !validDate(body?.periodStart ?? null) || !validDate(body?.periodEnd ?? null)) {
    return NextResponse.json({ error: "Isi laporan pembayaran tidak valid atau belum lengkap." }, { status: 400 });
  }
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const duplicate = await client.query("select id from finance_imports where user_id = $1 and file_hash = $2", [user.id, body.fileHash]);
    if (duplicate.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ ok: true, duplicate: true, processed: 0 });
    }
    const importResult = await client.query<{ id: string }>(
      `insert into finance_imports
       (user_id, file_name, file_hash, period_start, period_end, currency, summary_settlement,
        summary_revenue, summary_fees, summary_adjustments, detail_settlement, reconciliation_difference, row_count)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [user.id, body.fileName, body.fileHash, body.periodStart, body.periodEnd, body.currency || "IDR",
       body.summarySettlement, body.summaryRevenue, body.summaryFees, body.summaryAdjustments,
       body.detailSettlement, body.reconciliationDifference, entries.length]
    );
    for (const entry of entries) {
      const result = await client.query<{ id: string }>(
        `insert into finance_entries
         (user_id, import_id, transaction_id, transaction_type, order_date, payment_date, currency,
          settlement_amount, total_revenue, total_fees, adjustment_amount, related_order_id,
          buyer_payment, platform_discount, seller_discount, product_detail, source_row, dedupe_key)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         on conflict (user_id, dedupe_key) do update set
          import_id=excluded.import_id, order_date=excluded.order_date, payment_date=excluded.payment_date,
          settlement_amount=excluded.settlement_amount, total_revenue=excluded.total_revenue,
          total_fees=excluded.total_fees, adjustment_amount=excluded.adjustment_amount,
          related_order_id=excluded.related_order_id, buyer_payment=excluded.buyer_payment,
          platform_discount=excluded.platform_discount, seller_discount=excluded.seller_discount,
          product_detail=excluded.product_detail, source_row=excluded.source_row
         returning id`,
        [user.id, importResult.rows[0].id, entry.transaction_id, entry.transaction_type, entry.order_date,
         entry.payment_date, entry.currency, entry.settlement_amount, entry.total_revenue, entry.total_fees,
         entry.adjustment_amount, entry.related_order_id, entry.buyer_payment, entry.platform_discount,
         entry.seller_discount, entry.product_detail, entry.source_row, entry.dedupe_key]
      );
      const entryId = result.rows[0].id;
      await client.query("delete from finance_components where finance_entry_id = $1", [entryId]);
      for (const component of entry.components || []) {
        await client.query(
          `insert into finance_components (finance_entry_id, code, label, column_index, amount) values ($1,$2,$3,$4,$5)`,
          [entryId, component.code, component.label, component.column_index, component.amount]
        );
      }
    }
    await client.query("commit");
    return NextResponse.json({ ok: true, duplicate: false, processed: entries.length });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error("Finance import failed", error);
    return NextResponse.json({ error: "Gagal menyimpan detail laporan keuangan." }, { status: 500 });
  } finally {
    client.release();
  }
}
