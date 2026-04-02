import type { StudioModuleDefinition } from "@/types/studio";

export const DEFAULT_GEMINI_BASE_URL = "https://mccum.com/";

export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
export const DEFAULT_GEMINI_HQ_IMAGE_MODEL = "gemini-3-pro-image-preview";
export const DEFAULT_TEXT_MODEL = "gemini-3-flash-preview";

export const DEFAULT_IMAGE_MODEL = DEFAULT_GEMINI_IMAGE_MODEL;
export const DEFAULT_HQ_IMAGE_MODEL = DEFAULT_GEMINI_HQ_IMAGE_MODEL;

export const IMAGE_MODEL_OPTIONS = [
  {
    value: "gemini-3-pro-image-preview",
    label: "Gemini 3 Pro Image (Preview)",
  },
  {
    value: "gemini-3.0-pro-image",
    label: "Gemini 3 Pro flow",
  },
  {
    value: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image (Preview)",
  },
  {
    value: "gemini-3.1-flash-image",
    label: "Gemini 3.1 Flash flow",
  },
] as const;

export const PREVIEW_STUDIO_IMAGE_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
] as const;

export const FLOW_STUDIO_IMAGE_MODELS = [
  "gemini-3.0-pro-image",
  "gemini-3.1-flash-image",
] as const;

export const PREVIEW_STUDIO_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export const FLOW_STUDIO_ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
] as const;

export const PREVIEW_STUDIO_IMAGE_SIZES = ["1K", "2K", "4K"] as const;
export const FLOW_STUDIO_IMAGE_SIZES = ["1K", "2K"] as const;

export const GEMINI_PREVIEW_IMAGE_MODELS = PREVIEW_STUDIO_IMAGE_MODELS;
export const GEMINI_PREVIEW_ASPECT_RATIOS = PREVIEW_STUDIO_ASPECT_RATIOS;
export const GEMINI_PREVIEW_IMAGE_SIZES = PREVIEW_STUDIO_IMAGE_SIZES;
export const BUDGET_STUDIO_IMAGE_MODELS = FLOW_STUDIO_IMAGE_MODELS;
export const BUDGET_STUDIO_ASPECT_RATIOS = FLOW_STUDIO_ASPECT_RATIOS;
export const BUDGET_STUDIO_IMAGE_SIZES = FLOW_STUDIO_IMAGE_SIZES;

export function isFlowStudioImageModel(model: string): boolean {
  return (FLOW_STUDIO_IMAGE_MODELS as readonly string[]).includes(model);
}

export function isBudgetStudioImageModel(model: string): boolean {
  return isFlowStudioImageModel(model);
}

export function isPreviewStudioImageModel(model: string): boolean {
  return (PREVIEW_STUDIO_IMAGE_MODELS as readonly string[]).includes(model);
}

export function isSupportedStudioImageModel(model: string): boolean {
  return isPreviewStudioImageModel(model) || isFlowStudioImageModel(model);
}

export function normalizeStudioImageModel(model: string): string {
  return isSupportedStudioImageModel(model) ? model : DEFAULT_IMAGE_MODEL;
}

export function getDefaultImageModel(): string {
  return DEFAULT_IMAGE_MODEL;
}

export function getDefaultHqImageModel(): string {
  return DEFAULT_HQ_IMAGE_MODEL;
}

export function getQualityModeModel(
  qualityMode: "speed-budget" | "hq-budget",
): string {
  return qualityMode === "speed-budget"
    ? "gemini-3.1-flash-image"
    : "gemini-3.0-pro-image";
}

export function getSupportedStudioAspectRatios(
  model: string,
): readonly string[] | null {
  const normalizedModel = normalizeStudioImageModel(model);

  if (isFlowStudioImageModel(normalizedModel)) {
    return FLOW_STUDIO_ASPECT_RATIOS;
  }

  if (isPreviewStudioImageModel(normalizedModel)) {
    return PREVIEW_STUDIO_ASPECT_RATIOS;
  }

  return null;
}

export function getSupportedStudioImageSizes(
  model: string,
): readonly string[] | null {
  const normalizedModel = normalizeStudioImageModel(model);

  if (isFlowStudioImageModel(normalizedModel)) {
    return FLOW_STUDIO_IMAGE_SIZES;
  }

  if (isPreviewStudioImageModel(normalizedModel)) {
    return PREVIEW_STUDIO_IMAGE_SIZES;
  }

  return null;
}

export function clampStudioAspectRatio(model: string, aspectRatio: string): string {
  const supported = getSupportedStudioAspectRatios(model);
  if (!supported) {
    return aspectRatio;
  }

  return supported.includes(aspectRatio) ? aspectRatio : supported[0] ?? aspectRatio;
}

export function clampStudioImageSize(model: string, imageSize: string): string {
  const supported = getSupportedStudioImageSizes(model);
  if (!supported) {
    return imageSize;
  }

  if (supported.includes(imageSize)) {
    return imageSize;
  }

  if (imageSize === "4K" && supported.includes("2K")) {
    return "2K";
  }

  return supported[0] ?? imageSize;
}

export const STUDIO_NAV_ITEMS: StudioModuleDefinition[] = [
  {
    id: "main",
    label: "主图",
    shortLabel: "主图",
    badge: "核心",
    description: "生成适合电商平台投放的商品主图、首图与场景图。",
    helper: "上传商品图后，选择平台、比例和创意方向，快速生成高转化主视觉。",
  },
  {
    id: "detail",
    label: "详情图",
    shortLabel: "详情",
    description: "围绕卖点、材质、参数和场景，生成可直接用于详情页的整套图片。",
    helper: "可多选详情主题，系统会按已选主题分别生成对应图片。",
  },
  {
    id: "style-clone",
    label: "风格复刻",
    shortLabel: "复刻",
    description: "上传商品图与参考图，先分析参考图风格，再生成更统一的商品视觉。",
    helper: "当前优先支持单产品复刻，重点保护商品主体，同时借鉴参考图的布光、构图和情绪。",
  },
  {
    id: "retouch",
    label: "精修",
    shortLabel: "精修",
    description: "对已有图片做去背景、补光、修瑕、换背景和局部重绘。",
    helper: "适合把现有素材修成更可投放、更整洁、更高级的版本。",
  },
  {
    id: "fashion",
    label: "服装",
    shortLabel: "服装",
    badge: "试穿",
    description: "支持服装上身试穿、一键换装、服装平铺和换姿势。",
    helper: "当前优先把上衣和下装试穿做稳，自动提炼版型保护点后再生成。",
  },
  {
    id: "commerce",
    label: "带货",
    shortLabel: "带货",
    badge: "批量",
    description: "生成带货图片，并配套批量输出标题、文案、标签、CTA 和视频分镜。",
    helper: "同一商品可以同时测试多套平台角度，当前批量文案并发限制为 5。",
  },
];
