"use client";

import { useMemo, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import type { OrderItem, SkuCost } from "@/lib/types";
import { fmt } from "@/lib/format";

type Props = {
  items: OrderItem[];
  costs: SkuCost[];
  onChanged: () => Promise<void>;
  setStatus: (value: string, kind?: "ok" | "err") => void;
};

const emptyFields = { purchase_cost: 0, inbound_freight: 0, direct_handling: 0, packaging_cost: 0, other_direct_cost: 0 };

export default function HppManager({ items, costs, onChanged, setStatus }: Props) {
  const variants = useMemo(() => Array.from(new Map(items.map((item) => [`${item.sku_id}|${item.variation}`, item])).values())
    .sort((a, b) => a.product_name.localeCompare(b.product_name)), [items]);
  const [selected, setSelected] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [fields, setFields] = useState(emptyFields);
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedItem = variants.find((item) => `${item.sku_id}|${item.variation}` === selected);
  const total = Object.values(fields).reduce((sum, value) => sum + Number(value || 0), 0);

  function selectVariant(value: string) {
    setSelected(value);
    const item = variants.find((candidate) => `${candidate.sku_id}|${candidate.variation}` === value);
    if (!item) return;
    const existing = costs.find((cost) => cost.sku_id === item.sku_id && cost.variation === item.variation);
    if (existing) {
      setEffectiveFrom(String(existing.effective_from).slice(0, 10));
      setFields({ purchase_cost: existing.purchase_cost, inbound_freight: existing.inbound_freight, direct_handling: existing.direct_handling, packaging_cost: existing.packaging_cost, other_direct_cost: existing.other_direct_cost });
      setSupplier(existing.supplier);
      setNotes(existing.notes);
      return;
    }
    const firstOrderDate = items.filter((candidate) => candidate.sku_id === item.sku_id && candidate.variation === item.variation)
      .map((candidate) => candidate.order_date).sort()[0];
    setEffectiveFrom(firstOrderDate || new Date().toISOString().slice(0, 10));
    setFields(emptyFields);
    setSupplier("");
    setNotes("");
  }

  async function save() {
    if (!selectedItem) return setStatus("Pilih SKU/variasi untuk menyimpan HPP.", "err");
    setSaving(true);
    try {
      const response = await fetch("/api/costs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        sku_id: selectedItem.sku_id, variation: selectedItem.variation, effective_from: effectiveFrom, ...fields, supplier, notes
      }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Gagal menyimpan HPP.");
      await onChanged();
      setStatus(`HPP ${selectedItem.product_name} tersimpan: ${fmt(total)} per unit.`, "ok");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menyimpan HPP.", "err");
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus histori HPP ini? Data yang sudah dipakai sebagai snapshot mungkin tidak dapat dihapus.")) return;
    const response = await fetch(`/api/costs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);
    if (!response.ok) return setStatus(data?.error || "Gagal menghapus HPP.", "err");
    await onChanged();
    setStatus("Histori HPP dihapus.", "ok");
  }

  return (
    <details className="hpp-manager">
      <summary>Master HPP per SKU/variasi ({costs.length} histori)</summary>
      <div className="hpp-form">
        <label className="wide">Produk / SKU<select value={selected} onChange={(event) => selectVariant(event.target.value)}>
          <option value="">Pilih produk...</option>
          {variants.map((item) => <option key={`${item.sku_id}|${item.variation}`} value={`${item.sku_id}|${item.variation}`}>{item.product_name} · {item.variation || "Tanpa variasi"} · {item.sku_id}</option>)}
        </select></label>
        <label>Mulai berlaku<input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
        {Object.entries({ purchase_cost: "Harga beli", inbound_freight: "Ongkir masuk/unit", direct_handling: "Penanganan langsung", packaging_cost: "Kemasan", other_direct_cost: "Biaya langsung lain" }).map(([key, label]) => (
          <label key={key}>{label}<input type="number" min="0" step="1" value={fields[key as keyof typeof fields]} onChange={(event) => setFields((current) => ({ ...current, [key]: Math.max(0, Number(event.target.value)) }))} /></label>
        ))}
        <label>Supplier<input value={supplier} onChange={(event) => setSupplier(event.target.value)} /></label>
        <label className="wide">Catatan<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <div className="hpp-total"><span>Total HPP/unit</span><strong>{fmt(total)}</strong></div>
        <button className="btn btn-primary" type="button" disabled={saving} onClick={save}><Save size={15} /> {saving ? "Menyimpan..." : "Simpan HPP"}</button>
      </div>
      {costs.length ? <div className="profit-table-wrap"><table className="profit-table compact"><thead><tr><th>SKU / Variasi</th><th>Berlaku</th><th>Harga Beli</th><th>Total HPP</th><th>Supplier</th><th /></tr></thead><tbody>
        {costs.map((cost) => <tr key={cost.id}><td>{cost.sku_id}<small>{cost.variation || "Tanpa variasi"}</small></td><td>{String(cost.effective_from).slice(0, 10)}</td><td>{fmt(cost.purchase_cost)}</td><td>{fmt(cost.total_unit_cost)}</td><td>{cost.supplier || "-"}</td><td><button className="icon-btn" type="button" title="Hapus" onClick={() => remove(cost.id)}><Trash2 size={14} /></button></td></tr>)}
      </tbody></table></div> : null}
    </details>
  );
}
