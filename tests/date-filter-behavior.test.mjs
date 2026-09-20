import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDateValue } from "../lib/date-filter.ts";

test("normalizeDateValue converts PostgreSQL Date objects to ISO date strings", () => {
  assert.equal(normalizeDateValue(new Date("2026-09-10T00:00:00.000Z")), "2026-09-10");
});

test("normalizeDateValue preserves ISO date strings", () => {
  assert.equal(normalizeDateValue("2026-09-10"), "2026-09-10");
});

test("normalizeDateValue converts slash-separated date_raw values", () => {
  assert.equal(normalizeDateValue("2026/09/10"), "2026-09-10");
});
