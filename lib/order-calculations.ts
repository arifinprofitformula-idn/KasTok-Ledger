import type { OrderItem } from "@/lib/types";

export type OrderStatusFilter = "all" | "completed" | "progress" | "cancelled";

export type ProductSaleRow = {
  key: string;
  productName: string;
  skuId: string;
  variation: string;
  completed: number;
  returned: number;
  netSold: number;
  shipped: number;
  pending: number;
  cancelled: number;
};

function statusOf(item: OrderItem) {
  return item.order_status.trim().toLocaleLowerCase("id-ID");
}

export function isCompletedOrder(item: OrderItem) {
  return statusOf(item) === "selesai";
}

export function isShippedOrder(item: OrderItem) {
  return statusOf(item) === "dikirim";
}

export function isPendingOrder(item: OrderItem) {
  return statusOf(item) === "perlu dikirim";
}

export function isCancelledOrder(item: OrderItem) {
  return statusOf(item) === "dibatalkan";
}

export function netSold(item: OrderItem) {
  return isCompletedOrder(item) ? Math.max(item.quantity - item.returned_quantity, 0) : 0;
}

export function filterOrderItems(
  items: OrderItem[],
  filter: { from: string; to: string; search: string; status: OrderStatusFilter }
) {
  const search = filter.search.trim().toLocaleLowerCase("id-ID");
  return items.filter((item) => {
    if (filter.from && item.order_date < filter.from) return false;
    if (filter.to && item.order_date > filter.to) return false;
    if (search && !`${item.product_name} ${item.variation} ${item.sku_id} ${item.seller_sku}`.toLocaleLowerCase("id-ID").includes(search)) return false;
    if (filter.status === "completed" && !isCompletedOrder(item)) return false;
    if (filter.status === "progress" && !isShippedOrder(item) && !isPendingOrder(item)) return false;
    if (filter.status === "cancelled" && !isCancelledOrder(item)) return false;
    return true;
  });
}

export function summarizeOrderItems(items: OrderItem[]) {
  const completed = items.filter(isCompletedOrder).reduce((sum, item) => sum + item.quantity, 0);
  const returned = items.filter(isCompletedOrder).reduce((sum, item) => sum + item.returned_quantity, 0);
  const shipped = items.filter(isShippedOrder).reduce((sum, item) => sum + item.quantity, 0);
  const pending = items.filter(isPendingOrder).reduce((sum, item) => sum + item.quantity, 0);
  const cancelled = items.filter(isCancelledOrder).reduce((sum, item) => sum + item.quantity, 0);
  return {
    completed,
    returned,
    netSold: Math.max(completed - returned, 0),
    shipped,
    pending,
    cancelled,
    uniqueProducts: new Set(items.map((item) => item.product_name)).size,
    uniqueSkus: new Set(items.map((item) => item.sku_id)).size,
    uniqueOrders: new Set(items.map((item) => item.order_id)).size
  };
}

function emptyRow(key: string, productName: string, skuId = "", variation = ""): ProductSaleRow {
  return { key, productName, skuId, variation, completed: 0, returned: 0, netSold: 0, shipped: 0, pending: 0, cancelled: 0 };
}

function addItem(row: ProductSaleRow, item: OrderItem) {
  if (isCompletedOrder(item)) {
    row.completed += item.quantity;
    row.returned += item.returned_quantity;
    row.netSold += netSold(item);
  }
  if (isShippedOrder(item)) row.shipped += item.quantity;
  if (isPendingOrder(item)) row.pending += item.quantity;
  if (isCancelledOrder(item)) row.cancelled += item.quantity;
}

export function aggregateProductSales(items: OrderItem[]) {
  const products = new Map<string, { summary: ProductSaleRow; variants: Map<string, ProductSaleRow> }>();
  items.forEach((item) => {
    const productKey = item.product_name;
    const product = products.get(productKey) || {
      summary: emptyRow(productKey, item.product_name),
      variants: new Map<string, ProductSaleRow>()
    };
    addItem(product.summary, item);

    const variantKey = `${item.sku_id}|${item.variation}`;
    const variant = product.variants.get(variantKey) || emptyRow(variantKey, item.product_name, item.sku_id, item.variation);
    addItem(variant, item);
    product.variants.set(variantKey, variant);
    products.set(productKey, product);
  });

  return Array.from(products.values())
    .map((product) => ({
      ...product,
      variants: new Map(Array.from(product.variants.entries()).sort((a, b) => b[1].netSold - a[1].netSold || b[1].shipped - a[1].shipped))
    }))
    .sort((a, b) => b.summary.netSold - a.summary.netSold || b.summary.shipped - a.summary.shipped || a.summary.productName.localeCompare(b.summary.productName));
}
