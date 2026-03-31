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
  "通用电商",
  "小红书",
  "抖音",
  "淘宝",
  "拼多多",
  "视频号",
] as const;

export type PlatformTarget = (typeof PLATFORM_TARGETS)[number];

export type JobStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "partial";

export type QualityMode = "speed" | "hq";

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
}

export interface GenerateStudioResponse {
  ok: boolean;
  job: {
    id: string;
    module: StudioModule;
    title: string;
    prompt: string;
    notes?: string;
    images: StudioImageResult[];
    copyResults?: CommerceCopyResult[];
    createdAt: string;
  };
}
