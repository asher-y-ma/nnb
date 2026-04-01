import { z } from "zod";

import {
  generateStudioAssets,
  getGenerationTotals,
} from "@/lib/gemini/client";
import { isFlowStudioImageModel } from "@/config/studio";
import type {
  DetailFocusId,
  GenerateStudioResponse,
  GenerateStudioStreamEvent,
  PlatformTarget,
  StudioJobResult,
} from "@/types/studio";

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
  detailFocusIds: z.array(z.string()).optional(),
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

function createJobMeta(payload: z.infer<typeof payloadSchema>): Pick<
  StudioJobResult,
  "id" | "module" | "title" | "createdAt" | "detailFocusIds"
> {
  const createdAt = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    module: payload.module,
    title: `${moduleLabels[payload.module]}-${createdAt.replace(/[:.]/g, "-")}`,
    createdAt,
    detailFocusIds: payload.detailFocusIds as DetailFocusId[] | undefined,
  };
}

function streamEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: GenerateStudioStreamEvent) {
  controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "请求体格式无效。" }, { status: 400 });
  }

  const rawPayload = formData.get("payload");
  if (typeof rawPayload !== "string") {
    return Response.json({ ok: false, error: "请求参数无效。" }, { status: 400 });
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(rawPayload));
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "请求参数校验失败。",
      },
      { status: 400 },
    );
  }

  const productImages = formData.getAll("productImages[]").filter(Boolean) as File[];
  const referenceImages = formData.getAll("referenceImages[]").filter(Boolean) as File[];
  const sourceImages = formData.getAll("sourceImages[]").filter(Boolean) as File[];
  const modelImages = formData.getAll("modelImages[]").filter(Boolean) as File[];
  const innerLayerImages = formData.getAll("innerLayerImages[]").filter(Boolean) as File[];

  const normalizedPayload = {
    ...payload,
    platform: payload.platform as PlatformTarget,
    detailFocusIds: payload.detailFocusIds as DetailFocusId[] | undefined,
  };

  const responseMode = request.headers.get("x-response-mode");
  const jobMeta = createJobMeta(payload);
  const totals = getGenerationTotals(normalizedPayload);
  const mode = responseMode === "stream" ? "ndjson-stream" : "json";

  console.info(`[studio-api:${requestId}] request:start`, {
    mode,
    upstreamMethod: isFlowStudioImageModel(normalizedPayload.imageModel)
      ? "generateContentStream"
      : "generateContent",
    module: normalizedPayload.module,
    imageModel: normalizedPayload.imageModel,
    textModel: normalizedPayload.textModel,
    aspectRatio: normalizedPayload.aspectRatio,
    imageSize: normalizedPayload.imageSize,
    count: normalizedPayload.count,
    batchCount: normalizedPayload.batchCount,
    productImages: productImages.length,
    referenceImages: referenceImages.length,
    sourceImages: sourceImages.length,
    modelImages: modelImages.length,
    innerLayerImages: innerLayerImages.length,
  });

  if (responseMode !== "stream") {
    try {
      const generated = await generateStudioAssets({
        payload: normalizedPayload,
        productImages,
        referenceImages,
        sourceImages,
        modelImages,
        innerLayerImages,
        requestId,
      });

      console.info(`[studio-api:${requestId}] request:success`, {
        mode,
        jobId: jobMeta.id,
        images: generated.images.length,
        copyResults: generated.copyResults.length,
        totals: generated.totals,
      });

      return Response.json({
        ok: true,
        job: {
          ...jobMeta,
          prompt: generated.prompt,
          notes: generated.notes,
          images: generated.images,
          copyResults: generated.copyResults,
        },
      } satisfies GenerateStudioResponse);
    } catch (error) {
      console.error(`[studio-api:${requestId}] request:error`, {
        mode,
        error: error instanceof Error ? error.message : String(error),
      });

      return Response.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "生成失败",
        },
        { status: 500 },
      );
    } finally {
      console.info(`[studio-api:${requestId}] request:finish`, {
        mode,
      });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        streamEvent(controller, {
          type: "started",
          job: jobMeta,
          totals,
        });

        const generated = await generateStudioAssets({
          payload: normalizedPayload,
          productImages,
          referenceImages,
          sourceImages,
          modelImages,
          innerLayerImages,
          requestId,
          onProgress: async (event) => {
            streamEvent(controller, event);
          },
        });

        console.info(`[studio-api:${requestId}] request:success`, {
          mode,
          jobId: jobMeta.id,
          images: generated.images.length,
          copyResults: generated.copyResults.length,
          totals: generated.totals,
        });

        streamEvent(controller, {
          type: "complete",
          totals: generated.totals,
          job: {
            ...jobMeta,
            prompt: generated.prompt,
            notes: generated.notes,
            images: generated.images,
            copyResults: generated.copyResults,
          },
        });
      } catch (error) {
        console.error(`[studio-api:${requestId}] request:error`, {
          mode,
          error: error instanceof Error ? error.message : String(error),
        });

        streamEvent(controller, {
          type: "error",
          error: error instanceof Error ? error.message : "生成失败",
        });
      } finally {
        console.info(`[studio-api:${requestId}] request:finish`, {
          mode,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
