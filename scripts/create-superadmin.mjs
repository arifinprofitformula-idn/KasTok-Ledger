import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

loadEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;

if (!url || !serviceRoleKey || !email || !password) {
  console.error("Missing env. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD");
  process.exit(1);
}

if (password.length < 12) {
  console.error("SUPERADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const { data: list, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error(`Failed to list users: ${listError.message}`);
  process.exit(1);
}

const existing = list.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { role: "superadmin" },
    app_metadata: { role: "superadmin" }
  });

  if (error) {
    console.error(`Failed to update superadmin: ${error.message}`);
    process.exit(1);
  }

  console.log(`Superadmin updated: ${email}`);
  process.exit(0);
}

const { error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { role: "superadmin" },
  app_metadata: { role: "superadmin" }
});

if (error) {
  console.error(`Failed to create superadmin: ${error.message}`);
  process.exit(1);
}

console.log(`Superadmin created: ${email}`);
