import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPool, query } from "@/lib/db";
import type { OrderItemCostSnapshot, SkuCost } from "@/lib/types";

const COST_FIELDS = ["purchase_cost", "inbound_freight", "direct_handling", "packaging_cost", "other_direct_cost"] as const;

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function mapNumbers<T extends Record<string, unknown>>(row: T, keys: string[]) {
  const copy: Record<string, unknown> = { ...row };
  keys.forEach((key) => { copy[key] = Number(copy[key]); });
  return copy as T;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [costs, snapshots] = await Promise.all([
      query<SkuCost>(`select * from sku_cost_history where user_id = $1 order by sku_id, variation, effective_from desc`, [user.id]),
      query<OrderItemCostSnapshot>(
        `select s.order_item_id, s.cost_history_id, s.total_unit_cost, s.applied_at
         from order_item_cost_snapshots s join order_items oi on oi.id = s.order_item_id
         where oi.user_id = $1`, [user.id]
      )
    ]);
    return NextResponse.json({
      costs: costs.rows.map((row) => mapNumbers(row, [...COST_FIELDS, "total_unit_cost"])),
      snapshots: snapshots.rows.map((row) => mapNumbers(row, ["total_unit_cost"]))
    });
  } catch (error) {
    console.error("Cost data load failed", error);
    return NextResponse.json({ error: "Tabel HPP belum siap. Jalankan npm run db:migrate." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const skuId = typeof body?.sku_id === "string" ? body.sku_id.trim() : "";
  const variation = typeof body?.variation === "string" ? body.variation.trim() : "";
  const effectiveFrom = typeof body?.effective_from === "string" ? body.effective_from : "";
  const values = COST_FIELDS.map((field) => number(body?.[field]));
  if (!skuId || skuId.length > 64 || variation.length > 500 || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || values.some((value) => value === null)) {
    return NextResponse.json({ error: "Data master HPP tidak valid." }, { status: 400 });
  }
  const total = (values as number[]).reduce((sum, value) => sum + value, 0);
  const supplier = typeof body?.supplier === "string" ? body.supplier.trim().slice(0, 500) : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await client.query<{ id: string }>(
      `insert into sku_cost_history
       (user_id, sku_id, variation, effective_from, purchase_cost, inbound_freight,
        direct_handling, packaging_cost, other_direct_cost, total_unit_cost, supplier, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (user_id, sku_id, variation, effective_from) do update set
        purchase_cost=excluded.purchase_cost, inbound_freight=excluded.inbound_freight,
        direct_handling=excluded.direct_handling, packaging_cost=excluded.packaging_cost,
        other_direct_cost=excluded.other_direct_cost, total_unit_cost=excluded.total_unit_cost,
        supplier=excluded.supplier, notes=excluded.notes, updated_at=now()
       returning id`,
      [user.id, skuId, variation, effectiveFrom, ...values, total, supplier, notes]
    );
    await client.query(
      `insert into order_item_cost_snapshots (order_item_id, cost_history_id, total_unit_cost, applied_at)
       select oi.id, chosen.id, chosen.total_unit_cost, now()
       from order_items oi
       join lateral (
         select c.id, c.total_unit_cost from sku_cost_history c
         where c.user_id=oi.user_id and c.sku_id=oi.sku_id and c.variation=oi.variation
           and c.effective_from <= oi.order_date
         order by c.effective_from desc limit 1
       ) chosen on true
       where oi.user_id=$1 and oi.sku_id=$2 and oi.variation=$3
       on conflict (order_item_id) do update set
        cost_history_id=excluded.cost_history_id, total_unit_cost=excluded.total_unit_cost, applied_at=now()`,
      [user.id, skuId, variation]
    );
    await client.query("commit");
    return NextResponse.json({ ok: true, id: result.rows[0].id, total_unit_cost: total });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error("Cost save failed", error);
    return NextResponse.json({ error: "Gagal menyimpan master HPP." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID HPP wajib diisi." }, { status: 400 });
  try {
    await query("delete from sku_cost_history where id=$1 and user_id=$2", [id, user.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "HPP sudah dipakai sebagai snapshot dan tidak dapat dihapus." }, { status: 409 });
  }
}
