import { z } from "zod";

import { ensureSupabaseProfile } from "@/lib/supabase/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const jobSchema = z.object({
  id: z.string().min(1),
  module: z.string().min(1),
  title: z.string().min(1),
  status: z.string().min(1),
  prompt: z.string().default(""),
  aspectRatio: z.string().default("3:4"),
  imageSize: z.string().default("1K"),
  platform: z.string().default("小红书"),
  resultCount: z.number().int().min(0),
  notes: z.string().optional(),
});

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

  const body = jobSchema.parse(await request.json());

  const { error } = await supabase.from("studio_jobs").upsert(
    {
      id: body.id,
      user_id: user.id,
      module: body.module,
      status: body.status,
      input_summary: {
        title: body.title,
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
        imageSize: body.imageSize,
        platform: body.platform,
      },
      output_summary: {
        notes: body.notes ?? "",
      },
      result_count: body.resultCount,
      local_cache_key: body.id,
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
