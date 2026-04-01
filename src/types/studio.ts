export const STUDIO_MODULES = [
  "main",
  "detail",
  "style-clone",
  "retouch",
  "fashion",
  "commerce",
] as const;

export type StudioModule = (typeof STUDIO_MODULES)[number];

export const ASPECT_RATIOS = [
  "1:1",
  "1:4",
  "4:1",
  "1:8",
  "8:1",
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

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const IMAGE_SIZES = ["512", "1K", "2K", "4K"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];

export const PLATFORM_TARGETS = [
  "\u901a\u7528\u7535\u5546",
  "\u5c0f\u7ea2\u4e66",
  "\u6296\u97f3",
  "\u6dd8\u5b9d",
  "\u62fc\u591a\u591a",
  "\u89c6\u9891\u53f7",
] as const;

export type PlatformTarget = (typeof PLATFORM_TARGETS)[number];

export const DETAIL_FOCUS_IDS = [
  "selling-point",
  "material",
  "parameters",
  "scene",
  "comparison",
  "craft",
  "package",
  "usage",
] as const;

export type DetailFocusId = (typeof DETAIL_FOCUS_IDS)[number];

export type JobStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "partial";

export type QualityMode = "speed" | "speed-budget" | "hq" | "hq-budget";

export interface StudioModuleDefinition {
  id: StudioModule;
  label: string;
  shortLabel: string;
  badge?: string;
  description: string;
  helper: string;
}

export interface LocalAssetRecord {
  id: string;
  kind: "input" | "output";
  role?: "product" | "reference" | "source" | "model" | "inner";
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
  caption?: string;
  description?: string;
}

export interface CommerceStoryboardFrame {
  title: string;
  direction: string;
  visualPrompt: string;
  overlayText?: string;
}

export interface CommerceCopyResult {
  id: string;
  title: string;
  body: string;
  tags: string[];
  cta: string;
  platform: PlatformTarget;
  openingLine?: string;
  shotList?: string[];
  sellingPoints?: string[];
  coverText?: string;
  storyboard?: CommerceStoryboardFrame[];
}

export interface LocalJobRecord {
  id: string;
  module: StudioModule;
  title: string;
  status: JobStatus;
  prompt: string;
  extraNotes?: string;
  productFacts?: string;
  tone?: string;
  garmentCategory?: string;
  workflowMode?: string;
  detailFocusIds?: DetailFocusId[];
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  platform: PlatformTarget;
  imageCount?: number;
  batchCount?: number;
  qualityMode?: QualityMode;
  inputAssetIds: string[];
  outputAssetIds: string[];
  notes?: string;
  textResults?: CommerceCopyResult[];
  createdAt: string;
  updatedAt: string;
}

export interface StudioSettings {
  apiBaseUrl: string;
  apiKey: string;
  defaultImageModel: string;
  hqImageModel: string;
  defaultTextModel: string;
  defaultAspectRatio: AspectRatio;
  defaultImageSize: ImageSize;
  rememberApiKey: boolean;
  syncToCloud: boolean;
}

export interface StudioImageResult {
  id: string;
  mimeType: string;
  base64Data: string;
  caption?: string;
  description?: string;
}

export interface StudioJobResult {
  id: string;
  module: StudioModule;
  title: string;
  prompt: string;
  notes?: string;
  images: StudioImageResult[];
  copyResults?: CommerceCopyResult[];
  detailFocusIds?: DetailFocusId[];
  createdAt: string;
}

export interface GenerationProgressTotals {
  images: number;
  copyResults: number;
}

export type GenerateStudioStreamEvent =
  | {
      type: "started";
      job: Pick<StudioJobResult, "id" | "module" | "title" | "createdAt" | "detailFocusIds">;
      totals: GenerationProgressTotals;
    }
  | {
      type: "analysis";
      notes?: string;
      prompt: string;
      totals: GenerationProgressTotals;
    }
  | {
      type: "image";
      image: StudioImageResult;
      imageIndex: number;
      totals: GenerationProgressTotals;
      notesDelta?: string;
    }
  | {
      type: "copy";
      copyResult: CommerceCopyResult;
      copyIndex: number;
      totals: GenerationProgressTotals;
    }
  | {
      type: "complete";
      job: StudioJobResult;
      totals: GenerationProgressTotals;
    }
  | {
      type: "error";
      error: string;
    };

export interface GenerateStudioResponse {
  ok: boolean;
  job: StudioJobResult;
}
