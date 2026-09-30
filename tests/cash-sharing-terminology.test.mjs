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

  assert.match(ui, /Dana Masuk Rekening \(Withdrawal\)/);
  assert.match(ui, /Dana Bersih Siap Dibagi/);
  assert.match(ui, /Catatan Marketplace Tambahan \(Informasi\)/);
  assert.match(ui, /Bagian Supplier/);
  assert.doesNotMatch(ui, /Bagian Supplier \+/);
  assert.doesNotMatch(ui, /Dana Masuk Rekening - Biaya Marketing GMV Pay/);
  assert.doesNotMatch(ui, /Gross Profit/i);
});

test("financial recap presents withdrawal and net share first, marketplace metrics as notes", async () => {
  const ledger = await source("ledger");

  assert.match(
    ledger,
    /Dana Masuk Rekening \(Withdrawal\)[\s\S]*?Dana Bersih Siap Dibagi[\s\S]*?Catatan Marketplace Tambahan \(Informasi\)[\s\S]*?Biaya Marketing GMV Pay/
  );
});

test("monthly spreadsheet uses the approved cash-sharing labels", async () => {
  const exportSource = await source("export");

  assert.match(exportSource, /Dana Masuk Rekening/);
  assert.match(exportSource, /Biaya Marketing GMV Pay/);
  assert.match(exportSource, /Pendapatan Tercatat Marketplace/);
  assert.match(exportSource, /Dana Bersih Siap Dibagi/);
  assert.match(exportSource, /Bagian Supplier/);
  assert.doesNotMatch(exportSource, /Bagian Supplier \+/);
  assert.doesNotMatch(exportSource, /Gross Profit/i);
});
