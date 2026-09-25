import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("PWA manifest exposes installable KasTok metadata and existing app icons", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(manifest.name, "KasTok Ledger");
  assert.equal(manifest.short_name, "KasTok");
  assert.equal(manifest.start_url, "/dashboard");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  for (const icon of manifest.icons) {
    assert.equal(existsSync(resolve(root, `public${icon.src}`)), true, `${icon.src} must exist`);
  }
});

test("service worker supports offline navigation without caching authenticated API responses", () => {
  const worker = read("public/sw.js");
  assert.match(worker, /skipWaiting/);
  assert.match(worker, /clients\.claim/);
  assert.match(worker, /\/offline/);
  assert.match(worker, /\/api\//);
  assert.match(worker, /request\.mode === "navigate"/);
});

test("root layout publishes manifest, theme and service-worker registration", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /manifest:\s*"\/manifest\.webmanifest"/);
  assert.match(layout, /themeColor/);
  assert.match(layout, /PwaRegistration/);
});
