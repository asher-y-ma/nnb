import { z } from "zod";

import { ensureSupabaseProfile } from "@/lib/supabase/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const settingsSchema = z.object({
  baseUrl: z.string().min(1),
  defaultImageModel: z.string().min(1),
  hqImageModel: z.string().min(1),
  defaultTextModel: z.string().min(1),
  defaultAspectRatio: z.string().min(1),
  defaultImageSize: z.string().min(1),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return Response.json(
      { ok: false, error: "Supabase 未配置。" },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, error: "未登录。" }, { status: 401 });
  }

  await ensureSupabaseProfile(supabase, user);

  const { data, error } = await supabase
    .from("provider_profiles")
    .select(
      "base_url, default_image_model, hq_image_model, default_text_model, default_aspect_ratio, default_image_size",
    )
    .eq("user_id", user.id)
    .eq("provider_type", "gemini")
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, settings: data ?? null });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return Response.json(
      { ok: false, error: "Supabase 未配置。" },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, error: "未登录。" }, { status: 401 });
  }

  await ensureSupabaseProfile(supabase, user);

  const body = settingsSchema.parse(await request.json());

  const { error } = await supabase.from("provider_profiles").upsert(
    {
      user_id: user.id,
      provider_type: "gemini",
      base_url: body.baseUrl,
      default_image_model: body.defaultImageModel,
      hq_image_model: body.hqImageModel,
      default_text_model: body.defaultTextModel,
      default_aspect_ratio: body.defaultAspectRatio,
      default_image_size: body.defaultImageSize,
    },
    {
      onConflict: "user_id,provider_type",
    },
  );

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
