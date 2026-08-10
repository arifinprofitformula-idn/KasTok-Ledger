import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] ||= value;
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

loadEnvFile();

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;

if (!databaseUrl || !email || !password) {
  console.error("Missing env. Required: DATABASE_URL, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD");
  process.exit(1);
}

if (password.length < 12) {
  console.error("SUPERADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

try {
  const passwordHash = await hashPassword(password);
  await pool.query(
    `insert into users (email, password_hash, role)
     values ($1, $2, 'superadmin')
     on conflict (email)
     do update set password_hash = excluded.password_hash, role = 'superadmin'`,
    [email.trim().toLowerCase(), passwordHash]
  );

  console.log(`Superadmin ready: ${email}`);
} finally {
  await pool.end();
}
