import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function ensureSupabaseProfile(
  supabase: SupabaseClient,
  user: User,
) {
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name:
        (user.user_metadata?.display_name as string | undefined) ??
        (user.email?.split("@")[0] ?? null),
    },
    {
      onConflict: "id",
    },
  );
}
