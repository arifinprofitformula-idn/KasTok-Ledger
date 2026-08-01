"use client";

import type { DateFilter, Granularity } from "@/lib/types";

type Props = {
  splitYou: number;
  setSplitYou: (value: number) => void;
  splitSupplier: number;
  setSplitSupplier: (value: number) => void;
  granularity: Granularity;
  setGranularity: (value: Granularity) => void;
  filter: DateFilter;
  setFilter: (value: DateFilter) => void;
};

export default function SplitControls({ splitYou, splitSupplier, setSplitYou, setSplitSupplier, granularity, setGranularity, filter, setFilter }: Props) {
  return (
    <div className="controls-row">
      <div className="split-config">
        <label>Bagian Anda</label>
        <input
          type="number"
          min="0"
          max="100"
          value={splitYou}
          onChange={(event) => {
            const value = Math.max(0, Math.min(100, Number(event.target.value) || 0));
            setSplitYou(value);
            setSplitSupplier(100 - value);
          }}
        />
        <span>%</span>
        <span className="eq">/</span>
        <label>Bagian Supplier</label>
        <input
          type="number"
          min="0"
          max="100"
          value={splitSupplier}
          onChange={(event) => {
            const value = Math.max(0, Math.min(100, Number(event.target.value) || 0));
            setSplitSupplier(value);
            setSplitYou(100 - value);
          }}
        />
        <span>%</span>
      </div>

      <div className="gran-toggle" aria-label="Granularitas rekap">
        {[
          ["day", "Harian"],
          ["week", "Mingguan"],
          ["month", "Bulanan"]
        ].map(([value, label]) => (
          <button key={value} className={`gran-btn ${granularity === value ? "active" : ""}`} type="button" onClick={() => setGranularity(value as Granularity)}>
            {label}
          </button>
        ))}
      </div>

      <div className="date-filter">
        <label>
          Dari
          <input type="date" value={filter.from} onChange={(event) => setFilter({ ...filter, from: event.target.value })} />
        </label>
        <label>
          Sampai
          <input type="date" value={filter.to} onChange={(event) => setFilter({ ...filter, to: event.target.value })} />
        </label>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setFilter({ from: "", to: "" })}>
          Reset
        </button>
      </div>
    </div>
  );
}
