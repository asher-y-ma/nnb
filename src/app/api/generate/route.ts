import { z } from "zod";

import { generateStudioAssets } from "@/lib/gemini/client";

export const runtime = "nodejs";

const payloadSchema = z.object({
  module: z.enum(["main", "detail", "style-clone", "retouch", "fashion", "commerce"]),
  baseUrl: z.string().min(1),
  prompt: z.string().default(""),
  extraNotes: z.string().optional(),
  productFacts: z.string().optional(),
  platform: z.string().default("通用电商"),
  aspectRatio: z.string().default("3:4"),
  imageSize: z.string().default("1K"),
  count: z.coerce.number().min(1).max(4).default(1),
  batchCount: z.coerce.number().min(1).max(5).default(3),
  tone: z.string().default("专业但不生硬"),
  garmentCategory: z.string().optional(),
  workflowMode: z.string().optional(),
  imageModel: z.string().min(1),
  textModel: z.string().min(1),
  apiKey: z.string().min(1, "缺少 Gemini API Key"),
});

const moduleLabels = {
  main: "主图",
  detail: "详情图",
  "style-clone": "风格复刻",
  retouch: "精修",
  fashion: "服装",
  commerce: "带货",
} as const;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawPayload = formData.get("payload");

    if (typeof rawPayload !== "string") {
      return Response.json({ ok: false, error: "请求参数无效。" }, { status: 400 });
    }

    const payload = payloadSchema.parse(JSON.parse(rawPayload));

    const productImages = formData.getAll("productImages[]").filter(Boolean) as File[];
    const referenceImages = formData.getAll("referenceImages[]").filter(Boolean) as File[];
    const sourceImages = formData.getAll("sourceImages[]").filter(Boolean) as File[];
    const modelImages = formData.getAll("modelImages[]").filter(Boolean) as File[];
    const innerLayerImages = formData.getAll("innerLayerImages[]").filter(Boolean) as File[];

    const generated = await generateStudioAssets({
      payload,
      productImages,
      referenceImages,
      sourceImages,
      modelImages,
      innerLayerImages,
    });

    return Response.json({
      ok: true,
      job: {
        id: crypto.randomUUID(),
        module: payload.module,
        title: `${moduleLabels[payload.module]}-${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}`,
        prompt: generated.prompt,
        notes: generated.notes,
        images: generated.images,
        copyResults: generated.copyResults,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "生成失败",
      },
      { status: 500 },
    );
  }
}
