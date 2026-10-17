import { appStore } from "@/lib/store";
import { demoAccountId } from "@/lib/store";
import { loadAccount } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ data: await loadAccount(demoAccountId) ?? appStore.account });
}
