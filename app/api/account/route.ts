import { getAccountContext } from "@/lib/auth-session";
import { getOnboardingCompleted } from "@/lib/auth-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAccountContext(request);
  const onboardingCompleted = context.authenticated ? await getOnboardingCompleted(context.accountId) : true;
  return Response.json({ data: context.account, meta: { authenticated: context.authenticated, onboardingCompleted } });
}
