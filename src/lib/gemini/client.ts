import pLimit from "p-limit";

import {
  buildCommerceCopyPrompt,
  buildFashionAnalysisPrompt,
  buildFashionAnalysisSummary,
  buildImagePrompt,
  buildStyleAnalysisPrompt,
  buildStyleAnalysisSummary,
  getDetailFocusPresetById,
  type GarmentReferenceBrief,
  type StyleReferenceBrief,
} from "@/lib/gemini/prompt-builders";
import {
  DETAIL_FOCUS_PRESETS,
  FASHION_GARMENT_PRESETS,
} from "@/lib/studio/workflow-presets";
import {
  clampStudioAspectRatio,
  clampStudioImageSize,
} from "@/config/studio";
import {
  createInlineDataPart,
  createTextPart,
  createUserContent,
  extractGeminiParts,
  extractGeminiText,
  geminiGenerateContent,
  resolveGeminiPartToBase64Image,
  summarizeGeminiPartsForLog,
  type GeminiTraceContext,
  type GeminiRequestPart,
} from "@/lib/gemini/rest-client";
import type {
  CommerceCopyResult,
  DetailFocusId,
  GenerateStudioStreamEvent,
  GenerationProgressTotals,
  ImageTextLanguage,
  PlatformTarget,
  StudioImageResult,
  StudioModule,
} from "@/types/studio";

interface GenerationPayload {
  module: StudioModule;
  baseUrl: string;
  prompt: string;
  extraNotes?: string;
  productFacts?: string;
  platform: PlatformTarget;
  aspectRatio: string;
  imageSize: string;
  count: number;
  batchCount: number;
  tone: string;
  garmentCategory?: string;
  workflowMode?: string;
  detailFocusIds?: DetailFocusId[];
  imageModel: string;
  textModel: string;
  apiKey: string;
  imageTextLanguage?: ImageTextLanguage;
}

interface ImageGenerationPlan {
  label: string;
  prompt: string;
  description?: string;
}

type ProgressEvent = Extract<
  GenerateStudioStreamEvent,
  { type: "analysis" | "image" | "copy" }
>;

type ProgressTaskOutcome =
  | {
      kind: "image";
      images: StudioImageResult[];
      notesDelta?: string;
    }
  | {
      kind: "copy";
      copyResult: CommerceCopyResult;
    };

const commerceCopySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    tags: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: { type: "string" },
    },
    cta: { type: "string" },
    openingLine: { type: "string" },
    coverText: { type: "string" },
    shotList: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: { type: "string" },
    },
    sellingPoints: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string" },
    },
    storyboard: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          direction: { type: "string" },
          visualPrompt: { type: "string" },
          overlayText: { type: "string" },
        },
        required: ["title", "direction", "visualPrompt", "overlayText"],
      },
    },
  },
  required: [
    "title",
    "body",
    "tags",
    "cta",
    "openingLine",
    "coverText",
    "shotList",
    "sellingPoints",
    "storyboard",
  ],
} as const;

const styleAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    palette: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" },
    },
    lighting: { type: "string" },
    composition: { type: "string" },
    background: { type: "string" },
    mood: { type: "string" },
    typography: { type: "string" },
    preserve: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" },
    },
    avoid: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" },
    },
  },
  required: [
    "summary",
    "palette",
    "lighting",
    "composition",
    "background",
    "mood",
    "typography",
    "preserve",
    "avoid",
  ],
} as const;

const fashionAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string" },
    silhouette: { type: "string" },
    fabric: { type: "string" },
    styling: { type: "string" },
    preserve: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: { type: "string" },
    },
  },
  required: ["category", "silhouette", "fabric", "styling", "preserve"],
} as const;

async function fileToInlinePart(file: File) {
  const arrayBuffer = await file.arrayBuffer();

  return createInlineDataPart({
    mimeType: file.type || "image/png",
    data: Buffer.from(arrayBuffer).toString("base64"),
  });
}

async function createLabeledImageParts(files: File[], label: string) {
  if (!files.length) {
    return [] as GeminiRequestPart[];
  }

  const imageParts = await Promise.all(files.map((file) => fileToInlinePart(file)));
  return [createTextPart(label), ...imageParts];
}

function normalizeJsonText(input: string) {
  return input
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseJsonObject<T>(input: string, fallback: T) {
  try {
    return JSON.parse(normalizeJsonText(input || "")) as T;
  } catch {
    return fallback;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isCommerceCopyOnly(payload: GenerationPayload) {
  return (
    payload.module === "commerce" &&
    (payload.workflowMode === "批量文案" || payload.workflowMode === "视频预备")
  );
}

export function getGenerationTotals(payload: GenerationPayload): GenerationProgressTotals {
  const imageTotal =
    payload.module === "detail"
      ? Math.max(1, payload.detailFocusIds?.length ?? 0)
      : isCommerceCopyOnly(payload)
        ? 0
        : clamp(payload.count, 1, 4);

  const copyTotal =
    payload.module === "commerce" ? clamp(payload.batchCount, 1, 5) : 0;

  return {
    images: imageTotal,
    copyResults: copyTotal,
  };
}

async function analyzeStyleReference({
  payload,
  referenceImages,
  trace,
}: {
  payload: GenerationPayload;
  referenceImages: File[];
  trace?: GeminiTraceContext;
}) {
  if (payload.module !== "style-clone" || referenceImages.length === 0) {
    return null;
  }

  try {
    const analysisResponse = await geminiGenerateContent({
      baseUrl: payload.baseUrl,
      apiKey: payload.apiKey,
      model: payload.textModel,
      trace: {
        ...trace,
        operation: "style-analysis",
      },
      body: {
        contents: [
          createUserContent([
            createTextPart(buildStyleAnalysisPrompt(payload.workflowMode)),
            ...(await createLabeledImageParts(
              referenceImages,
              "下面这些图片全部是风格参考图。只分析布光、构图、背景、色彩、情绪和排版氛围，不要分析它们是什么商品。",
            )),
          ]),
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: styleAnalysisSchema,
        },
      },
    });

    const parsed = parseJsonObject<StyleReferenceBrief>(extractGeminiText(analysisResponse), {
      summary: "延续参考图的整体视觉语言和品牌氛围。",
      palette: [],
      lighting: "",
      composition: "",
      background: "",
      mood: "",
      typography: "",
      preserve: [],
      avoid: [],
    });

    return {
      summary: parsed.summary?.trim() || "延续参考图的整体视觉语言和品牌氛围。",
      palette: parsed.palette?.filter(Boolean).slice(0, 6) ?? [],
      lighting: parsed.lighting?.trim() || "",
      composition: parsed.composition?.trim() || "",
      background: parsed.background?.trim() || "",
      mood: parsed.mood?.trim() || "",
      typography: parsed.typography?.trim() || "",
      preserve: parsed.preserve?.filter(Boolean).slice(0, 6) ?? [],
      avoid: parsed.avoid?.filter(Boolean).slice(0, 6) ?? [],
    } satisfies StyleReferenceBrief;
  } catch {
    return null;
  }
}

async function analyzeGarmentReference({
  payload,
  productImages,
  trace,
}: {
  payload: GenerationPayload;
  productImages: File[];
  trace?: GeminiTraceContext;
}) {
  if (payload.module !== "fashion" || productImages.length === 0) {
    return null;
  }

  try {
    const analysisResponse = await geminiGenerateContent({
      baseUrl: payload.baseUrl,
      apiKey: payload.apiKey,
      model: payload.textModel,
      trace: {
        ...trace,
        operation: "fashion-analysis",
      },
      body: {
        contents: [
          createUserContent([
            createTextPart(
              buildFashionAnalysisPrompt(payload.garmentCategory, payload.workflowMode),
            ),
            ...(await createLabeledImageParts(
              productImages.slice(0, 1),
              "下面是目标服装图，请提炼试穿时必须保护的版型、长度、印花、颜色和结构。",
            )),
          ]),
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: fashionAnalysisSchema,
        },
      },
    });

    const parsed = parseJsonObject<GarmentReferenceBrief>(extractGeminiText(analysisResponse), {
      category: payload.garmentCategory || "服装单品",
      silhouette: "",
      fabric: "",
      styling: "",
      preserve: [],
    });

    return {
      category: parsed.category?.trim() || payload.garmentCategory || "服装单品",
      silhouette: parsed.silhouette?.trim() || "",
      fabric: parsed.fabric?.trim() || "",
      styling: parsed.styling?.trim() || "",
      preserve: parsed.preserve?.filter(Boolean).slice(0, 8) ?? [],
    } satisfies GarmentReferenceBrief;
  } catch {
    return null;
  }
}

async function buildImageInputParts({
  payload,
  planPrompt,
  productImages,
  referenceImages,
  sourceImages,
  modelImages,
  innerLayerImages,
}: {
  payload: GenerationPayload;
  planPrompt: string;
  productImages: File[];
  referenceImages: File[];
  sourceImages: File[];
  modelImages: File[];
  innerLayerImages: File[];
}) {
  const parts: GeminiRequestPart[] = [];

  if (payload.module === "style-clone") {
    parts.push(
      ...(await createLabeledImageParts(
        productImages,
        "第一组图片是产品图，是唯一主体来源。最终商品必须来自这组图片，保留它的形态、材质、logo、印花、颜色和关键结构。",
      )),
    );
    parts.push(
      ...(await createLabeledImageParts(
        referenceImages,
        "第二组图片是风格参考图，只能借鉴布光、背景、构图、色彩和镜头语言。禁止直接复用这组图里的主体、包装、道具、人物或主版式。",
      )),
    );

    parts.push(createTextPart(planPrompt));
    return parts;
  }

  if (payload.module === "fashion") {
    parts.push(
      ...(await createLabeledImageParts(
        productImages,
        "第一组图片是目标服装图，必须保留版型、长度、印花、颜色、logo 和关键结构。",
      )),
    );

    if (modelImages.length) {
      parts.push(
        ...(await createLabeledImageParts(
          modelImages,
          "第二组图片是模特图，请保留模特身份、脸部、发型、肤色和基本姿态，只调整服装穿着关系。",
        )),
      );
    }

    if (innerLayerImages.length) {
      parts.push(
        ...(await createLabeledImageParts(
          innerLayerImages,
          "第三组图片是内搭参考图，只用于处理层次和遮挡关系，不要让内搭盖过目标服装。",
        )),
      );
    }

    parts.push(createTextPart(planPrompt));
    return parts;
  }

  if (payload.module === "retouch") {
    parts.push(
      ...(await createLabeledImageParts(
        sourceImages,
        "下面是待精修源图。优先保留主体，只做用户点名的局部修正。",
      )),
    );

    parts.push(createTextPart(planPrompt));
    return parts;
  }

  parts.push(
    ...(await createLabeledImageParts(
      productImages,
      "下面是产品图。最终画面必须以这些产品图为主体来源。",
    )),
  );

  if (referenceImages.length) {
    parts.push(
      ...(await createLabeledImageParts(
        referenceImages,
        "下面是辅助参考图，只能借鉴局部氛围、布光或构图，不得替换主体。",
      )),
    );
  }

  parts.push(createTextPart(planPrompt));
  return parts;
}

function createImagePlans({
  payload,
  styleBrief,
  garmentBrief,
}: {
  payload: GenerationPayload;
  styleBrief: StyleReferenceBrief | null;
  garmentBrief: GarmentReferenceBrief | null;
}) {
  if (payload.module === "detail") {
    const selectedPresets =
      payload.detailFocusIds
        ?.map((id) => getDetailFocusPresetById(id))
        .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset)) ?? [];

    const presets = selectedPresets.length ? selectedPresets : DETAIL_FOCUS_PRESETS.slice(0, 1);

    return presets.map((preset) => ({
      label: preset.label,
      description: preset.description,
      prompt: buildImagePrompt({
        module: payload.module,
        prompt: payload.prompt,
        extraNotes: payload.extraNotes,
        productFacts: payload.productFacts,
        platform: payload.platform,
        aspectRatio: payload.aspectRatio,
        workflowMode: payload.workflowMode,
        detailFocus: preset,
        imageTextLanguage: payload.imageTextLanguage,
      }),
    }));
  }

  const fashionLabel =
    payload.module === "fashion"
      ? FASHION_GARMENT_PRESETS.find(
          (preset) =>
            preset.label === payload.garmentCategory ||
            preset.id === payload.garmentCategory,
        )?.label ?? payload.garmentCategory
      : undefined;

  const baseLabel =
    payload.module === "fashion"
      ? `${payload.workflowMode || "服装生成"} · ${fashionLabel || "服装"}`
      : payload.workflowMode || "生成结果";

  const description =
    payload.module === "style-clone" && styleBrief
      ? styleBrief.summary
      : payload.module === "fashion" && garmentBrief
        ? garmentBrief.preserve.join("、")
        : undefined;

  const planCount = clamp(payload.count, 1, 4);

  return Array.from({ length: planCount }, (_, index) => ({
    label: planCount > 1 ? `${baseLabel} ${index + 1}` : baseLabel,
    description,
    prompt: buildImagePrompt({
      module: payload.module,
      prompt: payload.prompt,
      extraNotes: payload.extraNotes,
      productFacts: payload.productFacts,
      platform: payload.platform,
      aspectRatio: payload.aspectRatio,
      garmentCategory: payload.garmentCategory,
      workflowMode: payload.workflowMode,
      hasModelImage: false,
      hasInnerLayerImage: false,
      styleBrief,
      garmentBrief,
      imageTextLanguage: payload.imageTextLanguage,
    }),
  }));
}

function buildPromptBundle(plans: ImageGenerationPlan[]) {
  return plans.map((plan) => `【${plan.label}】\n${plan.prompt}`).join("\n\n");
}

function createInitialNoteSections({
  payload,
  styleBrief,
  garmentBrief,
}: {
  payload: GenerationPayload;
  styleBrief: StyleReferenceBrief | null;
  garmentBrief: GarmentReferenceBrief | null;
}) {
  const sections: string[] = [];

  if (payload.module === "style-clone" && styleBrief) {
    sections.push(buildStyleAnalysisSummary(styleBrief));
  }

  if (payload.module === "fashion" && garmentBrief) {
    sections.push(buildFashionAnalysisSummary(garmentBrief));
  }

  if (payload.module === "detail" && payload.detailFocusIds?.length) {
    const labels = payload.detailFocusIds
      .map((id) => getDetailFocusPresetById(id)?.label)
      .filter(Boolean)
      .join("、");

    if (labels) {
      sections.push(`本次会按以下详情主题分别出图：${labels}`);
    }
  }

  return sections;
}

function effectiveImageGenerationParams(
  imageModel: string,
  aspectRatio: string,
  imageSize: string,
): { aspectRatio: string; imageSize: string } {
  return {
    aspectRatio: clampStudioAspectRatio(imageModel, aspectRatio),
    imageSize: clampStudioImageSize(imageModel, imageSize),
  };
}

async function generateSingleImagePlan({
  payload,
  plan,
  productImages,
  referenceImages,
  sourceImages,
  modelImages,
  innerLayerImages,
  trace,
}: {
  payload: GenerationPayload;
  plan: ImageGenerationPlan;
  productImages: File[];
  referenceImages: File[];
  sourceImages: File[];
  modelImages: File[];
  innerLayerImages: File[];
  trace?: GeminiTraceContext;
}) {
  const { aspectRatio: genAspectRatio, imageSize: genImageSize } =
    effectiveImageGenerationParams(
      payload.imageModel,
      payload.aspectRatio,
      payload.imageSize,
    );

  const imageResponse = await geminiGenerateContent({
    baseUrl: payload.baseUrl,
    apiKey: payload.apiKey,
    model: payload.imageModel,
    trace: {
      ...trace,
      operation: `image:${payload.module}`,
    },
    body: {
      contents: [
        createUserContent(
          await buildImageInputParts({
            payload,
            planPrompt: plan.prompt,
            productImages,
            referenceImages,
            sourceImages,
            modelImages,
            innerLayerImages,
          }),
        ),
      ],
      tools: [],
      generationConfig: {
        candidateCount: 1,
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: genAspectRatio,
          imageSize: genImageSize,
        },
      },
    },
  });

  const notesDelta = extractGeminiText(imageResponse).trim();
  const parts = extractGeminiParts(imageResponse);
  const partSummary = summarizeGeminiPartsForLog(parts);
  console.info(`[gemini:${trace?.requestId ?? "no-trace"}] image:${payload.module} parsed-response`, {
    model: payload.imageModel,
    planLabel: plan.label,
    notesPreview: notesDelta ? notesDelta.slice(0, 240) : "",
    ...partSummary,
  });
  const resolvedImages = await Promise.all(
    parts.map((part) => resolveGeminiPartToBase64Image(part, payload.apiKey, trace)),
  );

  const images = resolvedImages
    .filter((resolved): resolved is NonNullable<typeof resolved> => Boolean(resolved))
    .map((resolved, index) => ({
      id: crypto.randomUUID(),
      mimeType: resolved.mimeType,
      base64Data: resolved.data,
      caption: index > 0 ? `${plan.label} ${index + 1}` : plan.label,
      description: plan.description,
    })) satisfies StudioImageResult[];

  console.info(`[gemini:${trace?.requestId ?? "no-trace"}] image:${payload.module} parsed-images`, {
    model: payload.imageModel,
    planLabel: plan.label,
    partCount: parts.length,
    resolvedImageCount: images.length,
    resolutionAttempts: resolvedImages.length,
    resolutionFailures: resolvedImages.filter((resolved) => !resolved).length,
  });

  if (images.length === 0) {
    console.warn(`[gemini:${trace?.requestId ?? "no-trace"}] image:${payload.module} no-images-after-parse`, {
      model: payload.imageModel,
      planLabel: plan.label,
      promptPreview: plan.prompt.slice(0, 280),
      notesPreview: notesDelta ? notesDelta.slice(0, 280) : "",
      ...partSummary,
    });
  }

  return {
    images,
    notesDelta: notesDelta || undefined,
  };
}

async function generateSingleCopyResult({
  payload,
  productImages,
  variantIndex,
  trace,
}: {
  payload: GenerationPayload;
  productImages: File[];
  variantIndex: number;
  trace?: GeminiTraceContext;
}) {
  const contents: GeminiRequestPart[] = [
    createTextPart(
      buildCommerceCopyPrompt({
        platform: payload.platform,
        tone: payload.tone,
        productFacts: payload.productFacts,
        prompt: payload.prompt,
        variantIndex,
        workflowMode: payload.workflowMode,
        hasImages: productImages.length > 0,
      }),
    ),
  ];

  if (productImages.length > 0) {
    const imageParts = await Promise.all(
      productImages.slice(0, 3).map((file) => fileToInlinePart(file)),
    );
    contents.push(...imageParts);
  }

  const copyResponse = await geminiGenerateContent({
    baseUrl: payload.baseUrl,
    apiKey: payload.apiKey,
    model: payload.textModel,
    trace: {
      ...trace,
      operation: "commerce-copy",
    },
    body: {
      contents: [createUserContent(contents)],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: commerceCopySchema,
      },
    },
  });

  const parsed = parseJsonObject<{
    title?: string;
    body?: string;
    tags?: string[];
    cta?: string;
    openingLine?: string;
    coverText?: string;
    shotList?: string[];
    sellingPoints?: string[];
    storyboard?: Array<{
      title?: string;
      direction?: string;
      visualPrompt?: string;
      overlayText?: string;
    }>;
  }>(extractGeminiText(copyResponse), {});

  return {
    id: crypto.randomUUID(),
    platform: payload.platform,
    title: parsed.title?.trim() || `带货标题 ${variantIndex}`,
    body: parsed.body?.trim() || "",
    tags: parsed.tags?.filter(Boolean).slice(0, 8) ?? [],
    cta: parsed.cta?.trim() || "点击了解更多",
    openingLine: parsed.openingLine?.trim(),
    coverText: parsed.coverText?.trim(),
    shotList: parsed.shotList?.filter(Boolean).slice(0, 6) ?? [],
    sellingPoints: parsed.sellingPoints?.filter(Boolean).slice(0, 5) ?? [],
    storyboard:
      parsed.storyboard
        ?.filter((frame) => frame?.title || frame?.direction || frame?.visualPrompt)
        .slice(0, 6)
        .map((frame) => ({
          title: frame.title?.trim() || "镜头",
          direction: frame.direction?.trim() || "",
          visualPrompt: frame.visualPrompt?.trim() || "",
          overlayText: frame.overlayText?.trim(),
        })) ?? [],
  } satisfies CommerceCopyResult;
}

async function emitInCompletionOrder<T>(
  tasks: Array<Promise<T>>,
  onResult: (result: T) => Promise<void> | void,
) {
  const pending = new Map(
    tasks.map((task, index) => [
      index,
      task.then((value) => ({
        index,
        value,
      })),
    ]),
  );

  while (pending.size > 0) {
    const settled = await Promise.race(pending.values());
    pending.delete(settled.index);
    await onResult(settled.value);
  }
}

export async function generateStudioAssets({
  payload,
  productImages,
  referenceImages,
  sourceImages,
  modelImages,
  innerLayerImages,
  onProgress,
  requestId,
}: {
  payload: GenerationPayload;
  productImages: File[];
  referenceImages: File[];
  sourceImages: File[];
  modelImages: File[];
  innerLayerImages: File[];
  onProgress?: (event: ProgressEvent) => Promise<void> | void;
  requestId?: string;
}) {
  const trace = { requestId } satisfies GeminiTraceContext;
  const totals = getGenerationTotals(payload);
  const shouldGenerateImages = totals.images > 0;

  const styleBrief = await analyzeStyleReference({
    payload,
    referenceImages,
    trace,
  });

  const garmentBrief = await analyzeGarmentReference({
    payload,
    productImages,
    trace,
  });

  const plans = shouldGenerateImages
    ? createImagePlans({
        payload,
        styleBrief,
        garmentBrief,
      }).map((plan) => ({
        ...plan,
        prompt:
          payload.module === "fashion"
            ? buildImagePrompt({
                module: payload.module,
                prompt: payload.prompt,
                extraNotes: payload.extraNotes,
                productFacts: payload.productFacts,
                platform: payload.platform,
                aspectRatio: payload.aspectRatio,
                garmentCategory: payload.garmentCategory,
                workflowMode: payload.workflowMode,
                hasModelImage: modelImages.length > 0,
                hasInnerLayerImage: innerLayerImages.length > 0,
                garmentBrief,
                imageTextLanguage: payload.imageTextLanguage,
              })
            : payload.module === "style-clone"
              ? buildImagePrompt({
                  module: payload.module,
                  prompt: payload.prompt,
                  extraNotes: payload.extraNotes,
                  productFacts: payload.productFacts,
                  platform: payload.platform,
                  aspectRatio: payload.aspectRatio,
                  workflowMode: payload.workflowMode,
                  styleBrief,
                  imageTextLanguage: payload.imageTextLanguage,
                })
              : plan.prompt,
      }))
    : [];

  const promptBundle = buildPromptBundle(plans);
  const noteSections = createInitialNoteSections({
    payload,
    styleBrief,
    garmentBrief,
  });

  await onProgress?.({
    type: "analysis",
    notes: noteSections.filter(Boolean).join("\n\n") || undefined,
    prompt: promptBundle,
    totals,
  });

  const images: StudioImageResult[] = [];
  const copyResults: CommerceCopyResult[] = [];
  const tasks: Array<Promise<ProgressTaskOutcome>> = [];
  const imageLimit = pLimit(payload.module === "detail" ? 2 : 3);
  const copyLimit = pLimit(5);

  for (const plan of plans) {
    tasks.push(
      imageLimit(async () => {
        const result = await generateSingleImagePlan({
          payload,
          plan,
          productImages,
          referenceImages,
          sourceImages,
          modelImages,
          innerLayerImages,
          trace,
        });

        return {
          kind: "image",
          images: result.images,
          notesDelta: result.notesDelta,
        } satisfies ProgressTaskOutcome;
      }),
    );
  }

  if (payload.module === "commerce") {
    for (let index = 0; index < totals.copyResults; index += 1) {
      tasks.push(
        copyLimit(async () => {
          const copyResult = await generateSingleCopyResult({
            payload,
            productImages,
            variantIndex: index + 1,
            trace,
          });

          return {
            kind: "copy",
            copyResult,
          } satisfies ProgressTaskOutcome;
        }),
      );
    }
  }

  let emittedImageCount = 0;
  let emittedCopyCount = 0;

  await emitInCompletionOrder(tasks, async (task) => {
    if (task.kind === "image") {
      if (task.notesDelta) {
        noteSections.push(task.notesDelta);
      }

      for (const image of task.images) {
        images.push(image);
        emittedImageCount += 1;
        await onProgress?.({
          type: "image",
          image,
          imageIndex: emittedImageCount,
          totals,
          notesDelta: task.notesDelta,
        });
      }

      return;
    }

    copyResults.push(task.copyResult);
    emittedCopyCount += 1;
    await onProgress?.({
      type: "copy",
      copyResult: task.copyResult,
      copyIndex: emittedCopyCount,
      totals,
    });
  });

  if (shouldGenerateImages && images.length === 0) {
    console.error(`[gemini:${trace?.requestId ?? "no-trace"}] image:${payload.module} generation-finished-without-images`, {
      model: payload.imageModel,
      totals,
      generatedCopyResults: copyResults.length,
      promptPreview: promptBundle.slice(0, 320),
      hasStyleBrief: Boolean(styleBrief),
      hasGarmentBrief: Boolean(garmentBrief),
      productImages: productImages.length,
      referenceImages: referenceImages.length,
      sourceImages: sourceImages.length,
      modelImages: modelImages.length,
      innerLayerImages: innerLayerImages.length,
    });
    throw new Error("Gemini 未返回图片结果，请调整提示词、检查模型能力或稍后重试。");
  }

  return {
    images,
    notes: noteSections.filter(Boolean).join("\n\n"),
    copyResults,
    prompt: promptBundle,
    totals,
  };
}
