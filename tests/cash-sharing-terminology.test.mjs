import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  dashboard: new URL("../components/Dashboard.tsx", import.meta.url),
  ledger: new URL("../components/LedgerView.tsx", import.meta.url),
  chart: new URL("../components/PerformanceChart.tsx", import.meta.url),
  splitControls: new URL("../components/SplitControls.tsx", import.meta.url),
  export: new URL("../lib/export.ts", import.meta.url)
};

async function source(name) {
  return readFile(files[name], "utf8");
}

test("UI uses the approved cash-sharing terminology", async () => {
  const [dashboard, ledger, chart, splitControls] = await Promise.all([
    source("dashboard"),
    source("ledger"),
    source("chart"),
    source("splitControls")
  ]);
  const ui = `${dashboard}\n${ledger}\n${chart}\n${splitControls}`;

  assert.match(ui, /Dana Bersih Siap Dibagi/);
  assert.match(ui, /Bagian Supplier \+ HPP/);
  assert.match(ui, /Dana Masuk Rekening - Biaya Marketing GMV Pay/);
  assert.doesNotMatch(ui, /Gross Profit/i);
});

test("monthly spreadsheet uses the approved cash-sharing labels", async () => {
  const exportSource = await source("export");

  assert.match(exportSource, /Dana Masuk Rekening/);
  assert.match(exportSource, /Biaya Marketing GMV Pay/);
  assert.match(exportSource, /Pendapatan Tercatat Marketplace/);
  assert.match(exportSource, /Dana Bersih Siap Dibagi/);
  assert.match(exportSource, /Bagian Supplier \+ HPP/);
  assert.doesNotMatch(exportSource, /Gross Profit/i);
});
