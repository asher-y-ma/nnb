import { NextResponse } from "next/server";

import { ensureSupabaseProfile } from "@/lib/supabase/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = new URL("/settings?auth=success", request.url);

  const supabase = await createSupabaseServerClient();

  if (!supabase || !code) {
    return NextResponse.redirect(redirectTo);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error && data.user) {
    await ensureSupabaseProfile(supabase, data.user);
  }

  return NextResponse.redirect(redirectTo);
}
