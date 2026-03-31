import pLimit from "p-limit";

import { buildCommerceCopyPrompt, buildImagePrompt } from "@/lib/gemini/prompt-builders";
import {
  createInlineDataPart,
  createTextPart,
  createUserContent,
  extractGeminiInlineData,
  extractGeminiParts,
  extractGeminiText,
  geminiGenerateContent,
} from "@/lib/gemini/rest-client";
import type { CommerceCopyResult, StudioImageResult, StudioModule } from "@/types/studio";

interface GenerationPayload {
  module: StudioModule;
  baseUrl: string;
  prompt: string;
  extraNotes?: string;
  productFacts?: string;
  platform: string;
  aspectRatio: string;
  imageSize: string;
  count: number;
  batchCount: number;
  tone: string;
  garmentCategory?: string;
  workflowMode?: string;
  imageModel: string;
  textModel: string;
  apiKey: string;
}

const commerceCopySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description: "平台标题，适合直接发布或微调后发布。",
    },
    body: {
      type: "string",
      description: "完整带货文案正文。",
    },
    tags: {
      type: "array",
      description: "4 到 8 个中文短标签。",
      minItems: 4,
      maxItems: 8,
      items: {
        type: "string",
      },
    },
    cta: {
      type: "string",
      description: "简短直接的行动号召。",
    },
    openingLine: {
      type: "string",
      description: "短视频或直播开场钩子。",
    },
    shotList: {
      type: "array",
      description: "4 到 6 条镜头或分镜描述。",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "string",
      },
    },
    sellingPoints: {
      type: "array",
      description: "3 到 5 条核心卖点。",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "string",
      },
    },
  },
  required: ["title", "body", "tags", "cta", "openingLine", "shotList", "sellingPoints"],
} as const;

async function fileToInlinePart(file: File) {
  const arrayBuffer = await file.arrayBuffer();

  return createInlineDataPart({
    mimeType: file.type || "image/png",
    data: Buffer.from(arrayBuffer).toString("base64"),
  });
}

function normalizeJsonText(input: string) {
  return input.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function generateStudioAssets({
  payload,
  productImages,
  referenceImages,
  sourceImages,
  modelImages,
  innerLayerImages,
}: {
  payload: GenerationPayload;
  productImages: File[];
  referenceImages: File[];
  sourceImages: File[];
  modelImages: File[];
  innerLayerImages: File[];
}) {
  const shouldGenerateImages = !(
    payload.module === "commerce" &&
    (payload.workflowMode === "批量文案" || payload.workflowMode === "视频预备")
  );
  const imagePrompt = buildImagePrompt({
    module: payload.module,
    prompt: payload.prompt,
    extraNotes: payload.extraNotes,
    productFacts: payload.productFacts,
    platform: payload.platform as never,
    aspectRatio: payload.aspectRatio,
    garmentCategory: payload.garmentCategory,
    workflowMode: payload.workflowMode,
    hasModelImage: modelImages.length > 0,
    hasInnerLayerImage: innerLayerImages.length > 0,
  });

  const relevantFiles =
    payload.module === "retouch"
      ? sourceImages
      : [...productImages, ...referenceImages, ...modelImages, ...innerLayerImages];

  const parts = [
    createTextPart(imagePrompt),
    ...(await Promise.all(relevantFiles.map((file) => fileToInlinePart(file)))),
  ];

  let images: StudioImageResult[] = [];
  let notes = "";

  if (shouldGenerateImages) {
    const imageResponse = await geminiGenerateContent({
      baseUrl: payload.baseUrl,
      apiKey: payload.apiKey,
      model: payload.imageModel,
      body: {
        contents: [createUserContent(parts)],
        generationConfig: {
          candidateCount: Math.min(4, Math.max(1, payload.count)),
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: payload.aspectRatio,
            imageSize: payload.imageSize,
          },
        },
      },
    });

    const responseParts = extractGeminiParts(imageResponse);
    images = responseParts.reduce<StudioImageResult[]>((collection, part, index) => {
      const inlineData = extractGeminiInlineData(part);
      if (!inlineData?.data) {
        return collection;
      }

      collection.push({
        id: crypto.randomUUID(),
        mimeType: inlineData.mimeType,
        base64Data: inlineData.data,
        caption: `result-${index + 1}`,
      });

      return collection;
    }, []);

    notes = extractGeminiText(imageResponse);
  }

  let copyResults: CommerceCopyResult[] = [];

  if (payload.module === "commerce") {
    const limit = pLimit(5);

    copyResults = await Promise.all(
      Array.from({ length: Math.min(5, Math.max(1, payload.batchCount)) }).map(
        (_, index) =>
          limit(async () => {
            const copyResponse = await geminiGenerateContent({
              baseUrl: payload.baseUrl,
              apiKey: payload.apiKey,
              model: payload.textModel,
              body: {
                contents: [createUserContent([createTextPart(buildCommerceCopyPrompt({
                  platform: payload.platform as never,
                  tone: payload.tone,
                  productFacts: payload.productFacts,
                  prompt: payload.prompt,
                  variantIndex: index + 1,
                  workflowMode: payload.workflowMode,
                }))])],
                generationConfig: {
                  responseMimeType: "application/json",
                  responseJsonSchema: commerceCopySchema,
                },
              },
            });

            const parsed = JSON.parse(normalizeJsonText(extractGeminiText(copyResponse) || "{}")) as {
              title?: string;
              body?: string;
              tags?: string[];
              cta?: string;
              openingLine?: string;
              shotList?: string[];
              sellingPoints?: string[];
            };

            return {
              id: crypto.randomUUID(),
              platform: payload.platform as never,
              title: parsed.title?.trim() || `带货标题 ${index + 1}`,
              body: parsed.body?.trim() || "",
              tags: parsed.tags?.filter(Boolean).slice(0, 8) ?? [],
              cta: parsed.cta?.trim() || "点击了解更多",
              openingLine: parsed.openingLine?.trim(),
              shotList: parsed.shotList?.filter(Boolean).slice(0, 6) ?? [],
              sellingPoints: parsed.sellingPoints?.filter(Boolean).slice(0, 5) ?? [],
            };
          }),
      ),
    );
  }

  if (shouldGenerateImages && images.length === 0) {
    throw new Error("Gemini 未返回图片结果，请调整提示词、检查模型能力或稍后重试。");
  }

  return {
    images,
    notes,
    copyResults,
    prompt: imagePrompt,
  };
}
