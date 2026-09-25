import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPool, query } from "@/lib/db";
import type { OrderImport, OrderItem } from "@/lib/types";

const MAX_ITEMS_PER_FILE = 20_000;
const INSERT_CHUNK_SIZE = 500;

type OrderItemRow = Omit<OrderItem, "quantity" | "returned_quantity" | "unit_original_price" | "sku_subtotal_before_discount" | "sku_platform_discount" | "sku_seller_discount" | "sku_subtotal_after_discount" | "source_row"> & {
  quantity: string | number;
  returned_quantity: string | number;
  unit_original_price: string | number | null;
  sku_subtotal_before_discount: string | number | null;
  sku_platform_discount: string | number | null;
  sku_seller_discount: string | number | null;
  sku_subtotal_after_discount: string | number | null;
  source_row: string | number;
};

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    ...row,
    quantity: Number(row.quantity),
    returned_quantity: Number(row.returned_quantity),
    unit_original_price: row.unit_original_price === null ? null : Number(row.unit_original_price),
    sku_subtotal_before_discount: row.sku_subtotal_before_discount === null ? null : Number(row.sku_subtotal_before_discount),
    sku_platform_discount: row.sku_platform_discount === null ? null : Number(row.sku_platform_discount),
    sku_seller_discount: row.sku_seller_discount === null ? null : Number(row.sku_seller_discount),
    sku_subtotal_after_discount: row.sku_subtotal_after_discount === null ? null : Number(row.sku_subtotal_after_discount),
    source_row: Number(row.source_row)
  };
}

function boundedText(value: unknown, max: number, required = false) {
  return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
}

function nullableNumber(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isValidOrderItem(item: Partial<OrderItem>) {
  return Boolean(
    item &&
      boundedText(item.order_id, 64, true) &&
      /^\d+$/.test(item.order_id as string) &&
      boundedText(item.sku_id, 64, true) &&
      boundedText(item.seller_sku, 160) &&
      boundedText(item.product_name, 1000, true) &&
      boundedText(item.variation, 500) &&
      Number.isInteger(item.quantity) &&
      Number(item.quantity) >= 0 &&
      Number.isInteger(item.returned_quantity) &&
      Number(item.returned_quantity) >= 0 &&
      Number(item.returned_quantity) <= Number(item.quantity) &&
      boundedText(item.order_status, 120, true) &&
      boundedText(item.order_substatus, 200) &&
      typeof item.order_created_at === "string" &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(item.order_created_at) &&
      typeof item.order_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.order_date) &&
      typeof item.month_key === "string" &&
      /^\d{4}-\d{2}$/.test(item.month_key) &&
      nullableNumber(item.unit_original_price) &&
      nullableNumber(item.sku_subtotal_before_discount) &&
      nullableNumber(item.sku_platform_discount) &&
      nullableNumber(item.sku_seller_discount) &&
      nullableNumber(item.sku_subtotal_after_discount) &&
      boundedText(item.source_file, 500, true) &&
      Number.isInteger(item.source_row) &&
      Number(item.source_row) > 0 &&
      boundedText(item.dedupe_key, 800, true)
  );
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [itemsResult, importsResult] = await Promise.all([
      query<OrderItemRow>(
        `select id, user_id, order_id, sku_id, seller_sku, product_name, variation, quantity,
                returned_quantity, order_status, order_substatus, order_created_at, order_date,
                month_key, unit_original_price, sku_subtotal_before_discount, sku_platform_discount,
                sku_seller_discount, sku_subtotal_after_discount, source_file,
                source_row, dedupe_key, updated_at
         from order_items
         where user_id = $1
         order by order_date desc, order_created_at desc`,
        [user.id]
      ),
      query<OrderImport>(
        `select id, file_name, file_hash, row_count, imported_at
         from order_imports
         where user_id = $1
         order by imported_at desc
         limit 20`,
        [user.id]
      )
    ]);

    return NextResponse.json({ items: itemsResult.rows.map(mapOrderItem), imports: importsResult.rows });
  } catch (error) {
    console.error("Order data load failed", error);
    return NextResponse.json({ error: "Tabel pesanan belum siap. Jalankan npm run db:migrate." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fileName = body?.fileName;
  const fileHash = body?.fileHash;
  const items = Array.isArray(body?.items) ? (body.items as Partial<OrderItem>[]) : [];

  if (
    !boundedText(fileName, 500, true) ||
    typeof fileHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(fileHash) ||
    !items.length ||
    items.length > MAX_ITEMS_PER_FILE ||
    items.some((item) => !isValidOrderItem(item))
  ) {
    return NextResponse.json({ error: "Payload laporan pesanan tidak valid." }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const duplicate = await client.query<{ id: string }>(
      `select id from order_imports where user_id = $1 and file_hash = $2`,
      [user.id, fileHash]
    );
    if (duplicate.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ ok: true, duplicate: true, processed: 0 });
    }

    const importResult = await client.query<{ id: string }>(
      `insert into order_imports (user_id, file_name, file_hash, row_count)
       values ($1, $2, $3, $4)
       returning id`,
      [user.id, fileName, fileHash, items.length]
    );
    const importId = importResult.rows[0].id;

    for (let start = 0; start < items.length; start += INSERT_CHUNK_SIZE) {
      const chunk = items.slice(start, start + INSERT_CHUNK_SIZE);
      const values: unknown[] = [];
      const placeholders = chunk.map((item, index) => {
        const offset = index * 23;
        values.push(
          user.id,
          importId,
          item.order_id,
          item.sku_id,
          item.seller_sku,
          item.product_name,
          item.variation,
          item.quantity,
          item.returned_quantity,
          item.order_status,
          item.order_substatus,
          item.order_created_at,
          item.order_date,
          item.month_key,
          item.unit_original_price,
          item.sku_subtotal_before_discount,
          item.sku_platform_discount,
          item.sku_seller_discount,
          item.sku_subtotal_after_discount,
          fileName,
          item.source_row,
          item.dedupe_key,
          new Date()
        );
        return `(${Array.from({ length: 23 }, (_, column) => `$${offset + column + 1}`).join(", ")})`;
      });

      await client.query(
        `insert into order_items
          (user_id, import_id, order_id, sku_id, seller_sku, product_name, variation,
           quantity, returned_quantity, order_status, order_substatus, order_created_at,
           order_date, month_key, unit_original_price, sku_subtotal_before_discount,
           sku_platform_discount, sku_seller_discount, sku_subtotal_after_discount,
           source_file, source_row, dedupe_key, updated_at)
         values ${placeholders.join(", ")}
         on conflict (user_id, dedupe_key) do update set
           import_id = excluded.import_id,
           seller_sku = excluded.seller_sku,
           product_name = excluded.product_name,
           quantity = excluded.quantity,
           returned_quantity = excluded.returned_quantity,
           order_status = excluded.order_status,
           order_substatus = excluded.order_substatus,
           order_created_at = excluded.order_created_at,
           order_date = excluded.order_date,
           month_key = excluded.month_key,
           unit_original_price = excluded.unit_original_price,
           sku_subtotal_before_discount = excluded.sku_subtotal_before_discount,
           sku_platform_discount = excluded.sku_platform_discount,
           sku_seller_discount = excluded.sku_seller_discount,
           sku_subtotal_after_discount = excluded.sku_subtotal_after_discount,
           source_file = excluded.source_file,
           source_row = excluded.source_row,
           updated_at = excluded.updated_at`,
        values
      );
    }

    await client.query(
      `insert into order_item_cost_snapshots (order_item_id, cost_history_id, total_unit_cost)
       select oi.id, cost.id, cost.total_unit_cost
       from order_items oi
       join lateral (
         select c.id, c.total_unit_cost
         from sku_cost_history c
         where c.user_id = oi.user_id
           and c.sku_id = oi.sku_id
           and c.variation = oi.variation
           and c.effective_from <= oi.order_date
         order by c.effective_from desc
         limit 1
       ) cost on true
       where oi.user_id = $1
       on conflict (order_item_id) do nothing`,
      [user.id]
    );

    await client.query("commit");
    return NextResponse.json({ ok: true, duplicate: false, processed: items.length });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error("Order import failed", error);
    return NextResponse.json({ error: "Gagal menyimpan laporan pesanan." }, { status: 500 });
  } finally {
    client.release();
  }
}
