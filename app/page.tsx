import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAppEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!getAppEnv().isConfigured) {
    redirect("/login");
  }

  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
