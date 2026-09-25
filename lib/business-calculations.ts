import type { FinancialEntry, FinancialImport, OrderItem, OrderItemCostSnapshot } from "@/lib/types";

export type ProductProfitRow = {
  key: string;
  productName: string;
  skuId: string;
  variation: string;
  quantity: number;
  revenue: number;
  platformDiscount: number;
  marketplaceFees: number;
  hpp: number;
  contribution: number;
  margin: number | null;
  missingCostUnits: number;
  orders: number;
};

export type BusinessReport = {
  rows: ProductProfitRow[];
  recognizedRevenue: number;
  marketplaceFees: number;
  sellerDiscount: number;
  platformDiscount: number;
  settlement: number;
  hpp: number;
  grossProfit: number;
  contributionProfit: number;
  grossMargin: number | null;
  contributionMargin: number | null;
  adjustments: number;
  linkedOrders: number;
  totalOrderEntries: number;
  unmatchedEntries: number;
  costedUnits: number;
  missingCostUnits: number;
  costCoverage: number | null;
  feeBreakdown: { label: string; amount: number }[];
};

function linkedOrderId(entry: FinancialEntry) {
  if (entry.transaction_type.toLocaleLowerCase("id-ID") === "pesanan") return entry.transaction_id;
  return entry.related_order_id;
}

function completedQuantity(item: OrderItem) {
  return item.order_status.toLocaleLowerCase("id-ID") === "selesai"
    ? Math.max(item.quantity - item.returned_quantity, 0)
    : 0;
}

export function buildBusinessReport(
  orderItems: OrderItem[],
  entries: FinancialEntry[],
  snapshots: OrderItemCostSnapshot[]
): BusinessReport {
  const orders = new Map<string, OrderItem[]>();
  orderItems.forEach((item) => {
    const list = orders.get(item.order_id) || [];
    list.push(item);
    orders.set(item.order_id, list);
  });
  const financeByOrder = new Map<string, FinancialEntry[]>();
  let unmatchedEntries = 0;
  let adjustments = 0;
  entries.forEach((entry) => {
    const id = linkedOrderId(entry);
    if (!id || !orders.has(id)) {
      if (entry.transaction_type.toLocaleLowerCase("id-ID") !== "pesanan") adjustments += entry.adjustment_amount || entry.settlement_amount;
      else unmatchedEntries += 1;
      return;
    }
    const list = financeByOrder.get(id) || [];
    list.push(entry);
    financeByOrder.set(id, list);
  });

  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.order_item_id, snapshot.total_unit_cost]));
  const aggregate = new Map<string, ProductProfitRow>();
  const feeMap = new Map<string, number>();
  let recognizedRevenue = 0;
  let feesSigned = 0;
  let sellerDiscount = 0;
  let platformDiscount = 0;
  let settlement = 0;
  let hpp = 0;
  let costedUnits = 0;
  let missingCostUnits = 0;

  financeByOrder.forEach((financeEntries, orderId) => {
    const items = orders.get(orderId) || [];
    const orderRevenue = financeEntries.reduce((sum, entry) => sum + entry.total_revenue, 0);
    const orderFees = financeEntries.reduce((sum, entry) => sum + entry.total_fees, 0);
    const orderSettlement = financeEntries.reduce((sum, entry) => sum + entry.settlement_amount, 0);
    sellerDiscount += Math.abs(financeEntries.reduce((sum, entry) => sum + entry.seller_discount, 0));
    platformDiscount += financeEntries.reduce((sum, entry) => sum + entry.platform_discount, 0);
    const weights = items.map((item) => Math.max((item.sku_subtotal_after_discount || 0) + (item.sku_platform_discount || 0), 0));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const qtyTotal = items.reduce((sum, item) => sum + completedQuantity(item), 0);

    financeEntries.forEach((entry) => entry.components.forEach((component) => {
      feeMap.set(component.label, (feeMap.get(component.label) || 0) + component.amount);
    }));

    items.forEach((item, index) => {
      const quantity = completedQuantity(item);
      const allocation = weightTotal > 0 ? weights[index] / weightTotal : qtyTotal > 0 ? quantity / qtyTotal : 1 / Math.max(items.length, 1);
      const revenue = orderRevenue * allocation;
      const allocatedFees = orderFees * allocation;
      const unitCost = item.id ? snapshotMap.get(item.id) : undefined;
      const lineHpp = unitCost === undefined ? 0 : unitCost * quantity;
      if (unitCost === undefined) missingCostUnits += quantity;
      else costedUnits += quantity;
      const key = `${item.sku_id}|${item.variation}`;
      const current = aggregate.get(key) || {
        key, productName: item.product_name, skuId: item.sku_id, variation: item.variation,
        quantity: 0, revenue: 0, platformDiscount: 0, marketplaceFees: 0, hpp: 0,
        contribution: 0, margin: null, missingCostUnits: 0, orders: 0
      };
      current.quantity += quantity;
      current.revenue += revenue;
      current.platformDiscount += item.sku_platform_discount || 0;
      current.marketplaceFees += Math.abs(allocatedFees);
      current.hpp += lineHpp;
      current.contribution += revenue + allocatedFees - lineHpp;
      current.missingCostUnits += unitCost === undefined ? quantity : 0;
      current.orders += 1;
      current.margin = current.revenue ? current.contribution / current.revenue : null;
      aggregate.set(key, current);
    });
    recognizedRevenue += orderRevenue;
    feesSigned += orderFees;
    settlement += orderSettlement;
  });
  hpp = Array.from(aggregate.values()).reduce((sum, row) => sum + row.hpp, 0);
  const grossProfit = recognizedRevenue - hpp;
  const contributionProfit = recognizedRevenue + feesSigned - hpp;
  const totalCostUnits = costedUnits + missingCostUnits;

  return {
    rows: Array.from(aggregate.values()).sort((a, b) => b.contribution - a.contribution),
    recognizedRevenue,
    marketplaceFees: Math.abs(feesSigned),
    sellerDiscount,
    platformDiscount,
    settlement,
    hpp,
    grossProfit,
    contributionProfit,
    grossMargin: recognizedRevenue ? grossProfit / recognizedRevenue : null,
    contributionMargin: recognizedRevenue ? contributionProfit / recognizedRevenue : null,
    adjustments,
    linkedOrders: financeByOrder.size,
    totalOrderEntries: entries.filter((entry) => entry.transaction_type.toLocaleLowerCase("id-ID") === "pesanan").length,
    unmatchedEntries,
    costedUnits,
    missingCostUnits,
    costCoverage: totalCostUnits ? costedUnits / totalCostUnits : null,
    feeBreakdown: Array.from(feeMap, ([label, amount]) => ({ label, amount }))
      .filter((item) => item.amount !== 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  };
}

export function reconciliationStatus(item?: FinancialImport) {
  if (!item || item.reconciliation_difference === null) return "unknown" as const;
  return Math.abs(item.reconciliation_difference) < 0.5 ? "balanced" as const : "warning" as const;
}
