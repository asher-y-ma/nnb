"use client";

import {
  AlertTriangle,
  Copy,
  Download,
  FileJson2,
  FileText,
  Images,
  Layers3,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useSupabaseAuth } from "@/components/providers/auth-provider";
import { UploadCard } from "@/components/shared/upload-card";
import { ImageLightbox } from "@/components/studio/image-lightbox";
import {
  CopyResultsSection,
  InspirationBoard,
  ResultImageGrid,
  SelectableCard,
} from "@/components/studio/workspace-sections";
import {
  BUDGET_STUDIO_ASPECT_RATIOS,
  BUDGET_STUDIO_IMAGE_SIZES,
  isBudgetStudioImageModel,
  STUDIO_NAV_ITEMS,
} from "@/config/studio";
import {
  DETAIL_FOCUS_PRESETS,
  FASHION_GARMENT_PRESETS,
  MODULE_PROMPT_TEMPLATES,
  MODULE_WORKFLOW_OPTIONS,
  getDefaultWorkflowMode,
} from "@/lib/studio/workflow-presets";
import {
  buildCopyJsonBundle,
  buildCopyTextBundle,
  downloadAssetBundle,
  downloadBlob,
} from "@/lib/studio/exporters";
import {
  createInputAssetRecords,
  groupInputAssetFiles,
} from "@/lib/studio/local-assets";
import { nnbDb } from "@/lib/storage/db";
import { getAssetsByIds, saveAssets, saveJob } from "@/lib/storage/jobs";
import { cn } from "@/lib/utils/cn";
import { base64ToBlob } from "@/lib/utils/data-url";
import { useSettingsStore } from "@/stores/settings-store";
import type {
  AspectRatio,
  DetailFocusId,
  GenerateStudioResponse,
  GenerateStudioStreamEvent,
  GenerationProgressTotals,
  ImageSize,
  LocalAssetRecord,
  LocalJobRecord,
  PlatformTarget,
  QualityMode,
  StudioJobResult,
  StudioModule,
} from "@/types/studio";
import { ASPECT_RATIOS, IMAGE_SIZES, PLATFORM_TARGETS } from "@/types/studio";

const SPEED_BUDGET_IMAGE_MODEL = "gemini-3.1-flash-image";
const HQ_BUDGET_IMAGE_MODEL = "gemini-3.0-pro-image";

const QUALITY_MODE_OPTIONS: Array<{
  id: QualityMode;
  label: string;
  description: string;
}> = [
  { id: "speed", label: "默认速度", description: "沿用设置里的默认速度模型" },
  { id: "speed-budget", label: "速度优惠版", description: SPEED_BUDGET_IMAGE_MODEL },
  { id: "hq", label: "高质量模式", description: "沿用设置里的高质量模型" },
  { id: "hq-budget", label: "高质优惠版", description: HQ_BUDGET_IMAGE_MODEL },
];

const DEFAULT_TONE = "专业但不生硬";
const DEFAULT_GARMENT_CATEGORY = "上衣";
const DEFAULT_PLATFORM: PlatformTarget = "通用电商";

interface RestoreNotice {
  tone: "success" | "warning";
  message: string;
}

function resolveImageModelByQualityMode(
  qualityMode: QualityMode,
  settings: ReturnType<typeof useSettingsStore.getState>,
) {
  switch (qualityMode) {
    case "speed-budget":
      return SPEED_BUDGET_IMAGE_MODEL;
    case "hq":
      return settings.hqImageModel;
    case "hq-budget":
      return HQ_BUDGET_IMAGE_MODEL;
    case "speed":
    default:
      return settings.defaultImageModel;
  }
}

function appendNoteSection(currentNotes: string | undefined, nextSection?: string) {
  const trimmedNext = nextSection?.trim();
  if (!trimmedNext) {
    return currentNotes;
  }

  const trimmedCurrent = currentNotes?.trim();
  if (!trimmedCurrent) {
    return trimmedNext;
  }

  if (trimmedCurrent.includes(trimmedNext)) {
    return trimmedCurrent;
  }

  return `${trimmedCurrent}\n\n${trimmedNext}`;
}

async function readStreamEvents(
  response: Response,
  onEvent: (event: GenerateStudioStreamEvent) => Promise<void> | void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("生成接口未返回可读取的数据流。");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let lineBreakIndex = buffer.indexOf("\n");
    while (lineBreakIndex >= 0) {
      const line = buffer.slice(0, lineBreakIndex).trim();
      buffer = buffer.slice(lineBreakIndex + 1);

      if (line) {
        await onEvent(JSON.parse(line) as GenerateStudioStreamEvent);
      }

      lineBreakIndex = buffer.indexOf("\n");
    }

    if (done) {
      const tail = buffer.trim();
      if (tail) {
        await onEvent(JSON.parse(tail) as GenerateStudioStreamEvent);
      }
      return;
    }
  }
}

function getDefaultDetailFocusIds(): DetailFocusId[] {
  return [DETAIL_FOCUS_PRESETS[0].id];
}

function isFashionModelRequired(workflowMode: string) {
  return workflowMode !== "服装平铺";
}

export function StudioWorkspace({
  activeModule = "main",
  restoreJobId,
}: {
  activeModule?: StudioModule;
  restoreJobId?: string;
}) {
  const moduleMeta =
    STUDIO_NAV_ITEMS.find((item) => item.id === activeModule) ?? STUDIO_NAV_ITEMS[0];
  const settings = useSettingsStore();
  const { user, isConfigured } = useSupabaseAuth();

  const [productImages, setProductImages] = useState<File[]>([]);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [sourceImages, setSourceImages] = useState<File[]>([]);
  const [modelImages, setModelImages] = useState<File[]>([]);
  const [innerLayerImages, setInnerLayerImages] = useState<File[]>([]);
  const [workflowMode, setWorkflowMode] = useState(getDefaultWorkflowMode(activeModule));
  const [prompt, setPrompt] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [productFacts, setProductFacts] = useState("");
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [garmentCategory, setGarmentCategory] = useState(DEFAULT_GARMENT_CATEGORY);
  const [detailFocusIds, setDetailFocusIds] =
    useState<DetailFocusId[]>(getDefaultDetailFocusIds());
  const [platform, setPlatform] = useState<PlatformTarget>(DEFAULT_PLATFORM);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(settings.defaultAspectRatio);
  const [imageSize, setImageSize] = useState<ImageSize>(settings.defaultImageSize);
  const [count, setCount] = useState(1);
  const [batchCount, setBatchCount] = useState(3);
  const [qualityMode, setQualityMode] = useState<QualityMode>("speed");
  const [restoreNotice, setRestoreNotice] = useState<RestoreNotice | null>(null);
  const [result, setResult] = useState<StudioJobResult | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTotals, setGenerationTotals] =
    useState<GenerationProgressTotals | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredResult = result;
  void isPending;

  const resolvedImageModel = useMemo(
    () => resolveImageModelByQualityMode(qualityMode, settings),
    [qualityMode, settings.defaultImageModel, settings.hqImageModel],
  );

  const isBudgetModel = isBudgetStudioImageModel(resolvedImageModel);
  const aspectRatioOptions: AspectRatio[] = isBudgetModel
    ? [...BUDGET_STUDIO_ASPECT_RATIOS]
    : [...ASPECT_RATIOS];
  const imageSizeOptions: ImageSize[] = isBudgetModel
    ? [...BUDGET_STUDIO_IMAGE_SIZES]
    : [...IMAGE_SIZES];

  useEffect(() => {
    if (!isBudgetStudioImageModel(resolvedImageModel)) {
      return;
    }
    setAspectRatio((current) =>
      (BUDGET_STUDIO_ASPECT_RATIOS as readonly string[]).includes(current) ? current : "1:1",
    );
    setImageSize((current) => {
      if (current === "4K") {
        return "2K";
      }
      return (BUDGET_STUDIO_IMAGE_SIZES as readonly string[]).includes(current) ? current : "1K";
    });
  }, [resolvedImageModel]);

  const isCommerceCopyOnly =
    activeModule === "commerce" &&
    (workflowMode === "批量文案" || workflowMode === "视频预备");
  const expectedImageCount =
    activeModule === "detail"
      ? Math.max(1, detailFocusIds.length)
      : isCommerceCopyOnly
        ? 0
        : count;
  const generationStatusText = useMemo(() => {
    if (!generationTotals) {
      return "";
    }

    const imageProgress = `${result?.images.length ?? 0}/${generationTotals.images} 张图`;
    const copyProgress = generationTotals.copyResults
      ? `${result?.copyResults?.length ?? 0}/${generationTotals.copyResults} 组文案`
      : "";

    return [imageProgress, copyProgress].filter(Boolean).join(" · ");
  }, [generationTotals, result]);

  const selectedDetailFocuses = useMemo(
    () =>
      detailFocusIds
        .map((id) => DETAIL_FOCUS_PRESETS.find((preset) => preset.id === id))
        .filter((preset): preset is (typeof DETAIL_FOCUS_PRESETS)[number] => Boolean(preset)),
    [detailFocusIds],
  );

  const displayImages = useMemo(
    () =>
      result?.images.map((image, index) => ({
        src: `data:${image.mimeType};base64,${image.base64Data}`,
        alt: `${result.title}-${index + 1}`,
        caption: image.caption,
        description: image.description,
      })) ?? [],
    [result],
  );

  const resultMetrics = useMemo(
    () => [
      { label: "图片结果", value: `${deferredResult?.images.length ?? 0} 张` },
      { label: "文案结果", value: `${deferredResult?.copyResults?.length ?? 0} 组` },
      {
        label: activeModule === "detail" ? "详情主题" : "当前模式",
        value:
          activeModule === "detail"
            ? `${selectedDetailFocuses.length || 1} 项`
            : workflowMode,
      },
    ],
    [activeModule, deferredResult, selectedDetailFocuses.length, workflowMode],
  );

  function resetUploads() {
    setProductImages([]);
    setReferenceImages([]);
    setSourceImages([]);
    setModelImages([]);
    setInnerLayerImages([]);
  }

  function applyTemplate(template: string) {
    setPrompt((currentPrompt) => (currentPrompt ? `${currentPrompt}；${template}` : template));
  }

  function toggleDetailFocus(id: DetailFocusId) {
    setDetailFocusIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function copyTextToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error("复制失败，请检查浏览器权限。");
    }
  }

  function handleResetWorkspace() {
    resetUploads();
    setPrompt("");
    setExtraNotes("");
    setProductFacts("");
    setTone(DEFAULT_TONE);
    setGarmentCategory(DEFAULT_GARMENT_CATEGORY);
    setDetailFocusIds(getDefaultDetailFocusIds());
    setPlatform(DEFAULT_PLATFORM);
    setAspectRatio(settings.defaultAspectRatio);
    setImageSize(settings.defaultImageSize);
    setCount(1);
    setBatchCount(3);
    setQualityMode("speed");
    setWorkflowMode(getDefaultWorkflowMode(activeModule));
    setRestoreNotice(null);
    setResult(null);
    setGenerationTotals(null);
    setIsGenerating(false);
    setLightboxIndex(null);
    toast.message("当前工作台已清空。");
  }

  useEffect(() => {
    resetUploads();
    setPrompt("");
    setExtraNotes("");
    setProductFacts("");
    setTone(DEFAULT_TONE);
    setGarmentCategory(DEFAULT_GARMENT_CATEGORY);
    setDetailFocusIds(getDefaultDetailFocusIds());
    setPlatform(DEFAULT_PLATFORM);
    setAspectRatio(settings.defaultAspectRatio);
    setImageSize(settings.defaultImageSize);
    setCount(1);
    setBatchCount(3);
    setQualityMode("speed");
    setWorkflowMode(getDefaultWorkflowMode(activeModule));
    setRestoreNotice(null);
    setResult(null);
    setGenerationTotals(null);
    setIsGenerating(false);
    setLightboxIndex(null);
  }, [activeModule, settings.defaultAspectRatio, settings.defaultImageSize]);

  useEffect(() => {
    if (!restoreJobId) {
      return;
    }

    let active = true;

    const restoreJob = async () => {
      const job = await nnbDb.jobs.get(restoreJobId);

      if (!active) {
        return;
      }

      if (!job) {
        const missingMessage = "未找到要恢复的历史任务，请从历史页重新选择。";
        setRestoreNotice({ tone: "warning", message: missingMessage });
        toast.error(missingMessage);
        return;
      }

      setPrompt(job.prompt);
      setExtraNotes(job.extraNotes ?? "");
      setProductFacts(job.productFacts ?? "");
      setTone(job.tone ?? DEFAULT_TONE);
      setGarmentCategory(job.garmentCategory ?? DEFAULT_GARMENT_CATEGORY);
      setWorkflowMode(job.workflowMode ?? getDefaultWorkflowMode(job.module));
      setDetailFocusIds(job.detailFocusIds?.length ? job.detailFocusIds : getDefaultDetailFocusIds());
      setAspectRatio(job.aspectRatio);
      setImageSize(job.imageSize);
      setPlatform(job.platform);
      setCount(job.imageCount ?? 1);
      setBatchCount(job.batchCount ?? 3);
      setQualityMode(job.qualityMode ?? "speed");
      setResult(null);
      setGenerationTotals(null);
      setIsGenerating(false);
      setLightboxIndex(null);

      const storedAssets = job.inputAssetIds.length
        ? await getAssetsByIds(job.inputAssetIds)
        : [];

      if (!active) {
        return;
      }

      const availableAssets = storedAssets.filter(
        (asset): asset is LocalAssetRecord =>
          asset !== undefined && asset !== null && asset.kind === "input",
      );
      const groupedFiles = groupInputAssetFiles(availableAssets);

      setProductImages(groupedFiles.product);
      setReferenceImages(groupedFiles.reference);
      setSourceImages(groupedFiles.source);
      setModelImages(groupedFiles.model);
      setInnerLayerImages(groupedFiles.inner);

      let nextNotice: RestoreNotice;

      if (!job.inputAssetIds.length) {
        nextNotice = {
          tone: "warning",
          message: "已恢复任务参数。该记录没有可恢复的本地素材，请重新上传图片后继续生成。",
        };
      } else if (availableAssets.length === job.inputAssetIds.length) {
        nextNotice = {
          tone: "success",
          message: `已恢复任务参数与 ${availableAssets.length} 张本地素材，你可以直接继续生成。`,
        };
      } else {
        nextNotice = {
          tone: "warning",
          message: `已恢复任务参数，但仅找到 ${availableAssets.length}/${job.inputAssetIds.length} 张本地素材，请补齐缺失图片后继续生成。`,
        };
      }

      setRestoreNotice(nextNotice);
      if (nextNotice.tone === "success") {
        toast.success(nextNotice.message);
      } else {
        toast.message(nextNotice.message);
      }
    };

    restoreJob().catch(() => {
      if (!active) {
        return;
      }

      const errorMessage = "恢复历史任务失败，请重新上传图片或稍后再试。";
      setRestoreNotice({ tone: "warning", message: errorMessage });
      toast.error(errorMessage);
    });

    return () => {
      active = false;
    };
  }, [restoreJobId]);

  function validateBeforeGenerate() {
    if (!settings.apiBaseUrl.trim()) {
      toast.error("请先去设置页填写 Gemini API URL。");
      return false;
    }

    if (!settings.apiKey.trim()) {
      toast.error("请先去设置页填写 Gemini API Key。");
      return false;
    }

    if ((activeModule === "main" || activeModule === "detail") && productImages.length === 0) {
      toast.error("请先上传产品图。");
      return false;
    }

    if (activeModule === "detail" && detailFocusIds.length === 0) {
      toast.error("请至少选择一个详情图主题。");
      return false;
    }

    if (activeModule === "retouch" && sourceImages.length === 0) {
      toast.error("请先上传需要精修的图片。");
      return false;
    }

    if (
      activeModule === "style-clone" &&
      (productImages.length === 0 || referenceImages.length === 0)
    ) {
      toast.error("风格复刻至少需要产品图和参考图各一张。");
      return false;
    }

    if (activeModule === "fashion") {
      if (productImages.length === 0) {
        toast.error("服装模块至少需要上传服饰图。");
        return false;
      }

      if (isFashionModelRequired(workflowMode) && modelImages.length === 0) {
        toast.error("当前服装模式需要上传模特图。");
        return false;
      }
    }

    if (activeModule === "commerce") {
      if (isCommerceCopyOnly) {
        if (!prompt.trim() && !productFacts.trim()) {
          toast.error("批量文案或视频预备模式至少填写提示词或商品事实。");
          return false;
        }
      } else if (productImages.length === 0) {
        toast.error("图文带货模式请先上传产品图。");
        return false;
      }
    }

    return true;
  }

  async function syncJobToSupabase(job: LocalJobRecord) {
    if (!settings.syncToCloud || !isConfigured || !user) {
      return;
    }

    try {
      await fetch("/api/sync/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: job.id,
          module: job.module,
          title: job.title,
          status: job.status,
          prompt: job.prompt,
          aspectRatio: job.aspectRatio,
          imageSize: job.imageSize,
          platform: job.platform,
          resultCount: job.outputAssetIds.length,
          notes: job.notes,
        }),
      });
    } catch {
      toast.message("本地已保存，云端元数据可稍后再次同步。");
    }
  }

  async function persistResult(job: GenerateStudioResponse["job"]) {
    const inputAssetRecords = [
      ...createInputAssetRecords(productImages, "product", job.createdAt),
      ...createInputAssetRecords(referenceImages, "reference", job.createdAt),
      ...createInputAssetRecords(sourceImages, "source", job.createdAt),
      ...createInputAssetRecords(modelImages, "model", job.createdAt),
      ...createInputAssetRecords(innerLayerImages, "inner", job.createdAt),
    ];

    const outputAssetRecords: LocalAssetRecord[] = job.images.map((image, index) => {
      const blob = base64ToBlob(image.base64Data, image.mimeType);

      return {
        id: image.id,
        kind: "output",
        name: `${job.title}-${index + 1}.png`,
        mimeType: image.mimeType,
        size: blob.size,
        blob,
        createdAt: job.createdAt,
        caption: image.caption,
        description: image.description,
      };
    });

    const jobRecord: LocalJobRecord = {
      id: job.id,
      module: activeModule,
      title: job.title,
      status: "completed",
      prompt,
      extraNotes,
      productFacts,
      tone,
      garmentCategory,
      workflowMode,
      detailFocusIds,
      aspectRatio,
      imageSize,
      platform,
      imageCount: expectedImageCount,
      batchCount,
      qualityMode,
      inputAssetIds: inputAssetRecords.map((asset) => asset.id),
      outputAssetIds: outputAssetRecords.map((asset) => asset.id),
      notes: job.notes,
      textResults: job.copyResults,
      createdAt: job.createdAt,
      updatedAt: job.createdAt,
    };

    const allAssets = [...inputAssetRecords, ...outputAssetRecords];

    if (allAssets.length > 0) {
      await saveAssets(allAssets);
    }
    await saveJob(jobRecord);
    await syncJobToSupabase(jobRecord);
  }

  async function handleGenerate() {
    if (!validateBeforeGenerate()) {
      return;
    }

    const requestPayload = {
      module: activeModule,
      baseUrl: settings.apiBaseUrl,
      workflowMode,
      prompt,
      extraNotes,
      productFacts,
      platform,
      aspectRatio,
      imageSize,
      count: activeModule === "detail" ? 1 : count,
      batchCount,
      tone,
      garmentCategory,
      detailFocusIds,
      imageModel: resolveImageModelByQualityMode(qualityMode, settings),
      textModel: settings.defaultTextModel,
      apiKey: settings.apiKey,
    };

    const formData = new FormData();
    formData.set("payload", JSON.stringify(requestPayload));
    productImages.forEach((file) => formData.append("productImages[]", file));
    referenceImages.forEach((file) => formData.append("referenceImages[]", file));
    sourceImages.forEach((file) => formData.append("sourceImages[]", file));
    modelImages.forEach((file) => formData.append("modelImages[]", file));
    innerLayerImages.forEach((file) => formData.append("innerLayerImages[]", file));

    setResult(null);
    setLightboxIndex(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as GenerateStudioResponse & {
          error?: string;
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "生成失败");
        }

        setResult(payload.job);
        await persistResult(payload.job);
        toast.success("生成完成，记得尽快下载结果图。");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "生成失败");
      }
    });
  }

  async function handleGenerateStream() {
    if (!validateBeforeGenerate()) {
      return;
    }

    const requestPayload = {
      module: activeModule,
      baseUrl: settings.apiBaseUrl,
      workflowMode,
      prompt,
      extraNotes,
      productFacts,
      platform,
      aspectRatio,
      imageSize,
      count: activeModule === "detail" ? 1 : count,
      batchCount,
      tone,
      garmentCategory,
      detailFocusIds,
      imageModel: resolveImageModelByQualityMode(qualityMode, settings),
      textModel: settings.defaultTextModel,
      apiKey: settings.apiKey,
    };

    const formData = new FormData();
    formData.set("payload", JSON.stringify(requestPayload));
    productImages.forEach((file) => formData.append("productImages[]", file));
    referenceImages.forEach((file) => formData.append("referenceImages[]", file));
    sourceImages.forEach((file) => formData.append("sourceImages[]", file));
    modelImages.forEach((file) => formData.append("modelImages[]", file));
    innerLayerImages.forEach((file) => formData.append("innerLayerImages[]", file));

    setResult(null);
    setGenerationTotals(null);
    setLightboxIndex(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "x-response-mode": "stream",
        },
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | (GenerateStudioResponse & { error?: string })
          | null;
        throw new Error(payload?.error ?? "生成失败");
      }

      let completedJob: StudioJobResult | null = null;

      await readStreamEvents(response, async (event) => {
        if (event.type === "started") {
          setGenerationTotals(event.totals);
          setResult({
            ...event.job,
            prompt: "",
            notes: "",
            images: [],
            copyResults: [],
          });
          return;
        }

        if (event.type === "analysis") {
          setGenerationTotals(event.totals);
          setResult((current) =>
            current
              ? {
                  ...current,
                  prompt: event.prompt,
                  notes: appendNoteSection(current.notes, event.notes),
                }
              : current,
          );
          return;
        }

        if (event.type === "image") {
          setGenerationTotals(event.totals);
          setResult((current) =>
            current
              ? {
                  ...current,
                  notes: appendNoteSection(current.notes, event.notesDelta),
                  images: [...current.images, event.image],
                }
              : current,
          );
          return;
        }

        if (event.type === "copy") {
          setGenerationTotals(event.totals);
          setResult((current) =>
            current
              ? {
                  ...current,
                  copyResults: [...(current.copyResults ?? []), event.copyResult],
                }
              : current,
          );
          return;
        }

        if (event.type === "complete") {
          completedJob = event.job;
          setGenerationTotals(event.totals);
          setResult(event.job);
          return;
        }

        throw new Error(event.error);
      });

      if (!completedJob) {
        throw new Error("生成未正常完成，请稍后重试。");
      }

      await persistResult(completedJob);
      toast.success("生成完成，记得尽快下载结果图。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }
  void handleGenerate;

  async function handleGenerateSafe() {
    if (!validateBeforeGenerate()) {
      return;
    }

    const requestPayload = {
      module: activeModule,
      baseUrl: settings.apiBaseUrl,
      workflowMode,
      prompt,
      extraNotes,
      productFacts,
      platform,
      aspectRatio,
      imageSize,
      count: activeModule === "detail" ? 1 : count,
      batchCount,
      tone,
      garmentCategory,
      detailFocusIds,
      imageModel: resolveImageModelByQualityMode(qualityMode, settings),
      textModel: settings.defaultTextModel,
      apiKey: settings.apiKey,
    };

    const formData = new FormData();
    formData.set("payload", JSON.stringify(requestPayload));
    productImages.forEach((file) => formData.append("productImages[]", file));
    referenceImages.forEach((file) => formData.append("referenceImages[]", file));
    sourceImages.forEach((file) => formData.append("sourceImages[]", file));
    modelImages.forEach((file) => formData.append("modelImages[]", file));
    innerLayerImages.forEach((file) => formData.append("innerLayerImages[]", file));

    setResult(null);
    setGenerationTotals(null);
    setLightboxIndex(null);
    setIsGenerating(true);

    try {
      let completedJob: StudioJobResult | null = null;
      let serverSideError: Error | null = null;

      try {
        const streamResponse = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "x-response-mode": "stream",
          },
          body: formData,
        });

        if (!streamResponse.ok) {
          const payload = (await streamResponse.json().catch(() => null)) as
            | (GenerateStudioResponse & { error?: string })
            | null;
          throw new Error(payload?.error ?? "生成失败");
        }

        await readStreamEvents(streamResponse, async (event) => {
          if (event.type === "started") {
            setGenerationTotals(event.totals);
            setResult({
              ...event.job,
              prompt: "",
              notes: "",
              images: [],
              copyResults: [],
            });
            return;
          }

          if (event.type === "analysis") {
            setGenerationTotals(event.totals);
            setResult((current) =>
              current
                ? {
                    ...current,
                    prompt: event.prompt,
                    notes: appendNoteSection(current.notes, event.notes),
                  }
                : current,
            );
            return;
          }

          if (event.type === "image") {
            setGenerationTotals(event.totals);
            setResult((current) =>
              current
                ? {
                    ...current,
                    notes: appendNoteSection(current.notes, event.notesDelta),
                    images: [...current.images, event.image],
                  }
                : current,
            );
            return;
          }

          if (event.type === "copy") {
            setGenerationTotals(event.totals);
            setResult((current) =>
              current
                ? {
                    ...current,
                    copyResults: [...(current.copyResults ?? []), event.copyResult],
                  }
                : current,
            );
            return;
          }

          if (event.type === "complete") {
            completedJob = event.job;
            setGenerationTotals(event.totals);
            setResult(event.job);
            return;
          }

          serverSideError = new Error(event.error);
          throw serverSideError;
        });
      } catch (streamError) {
        if (serverSideError) {
          throw serverSideError;
        }

        setResult(null);
        setGenerationTotals(null);
        toast.message("流式响应被服务器或反向代理截断，已自动切换为普通模式。");

        const fallbackResponse = await fetch("/api/generate", {
          method: "POST",
          body: formData,
        });

        const fallbackPayload = (await fallbackResponse.json()) as GenerateStudioResponse & {
          error?: string;
        };

        if (!fallbackResponse.ok || !fallbackPayload.ok) {
          throw new Error(
            fallbackPayload.error ??
              (streamError instanceof Error ? streamError.message : "生成失败"),
          );
        }

        completedJob = fallbackPayload.job;
        setResult(fallbackPayload.job);
      }

      if (!completedJob) {
        throw new Error("生成未正常完成，请稍后重试。");
      }

      await persistResult(completedJob);
      toast.success("生成完成，记得尽快下载结果图。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  void handleGenerateStream;

  async function handleDownloadAll() {
    if (!deferredResult?.images.length) {
      toast.error("当前没有可下载的图片。");
      return;
    }

    const assets: LocalAssetRecord[] = deferredResult.images.map((image, index) => ({
      id: image.id,
      kind: "output",
      name: `${deferredResult.title}-${index + 1}.png`,
      mimeType: image.mimeType,
      size: image.base64Data.length,
      blob: base64ToBlob(image.base64Data, image.mimeType),
      createdAt: deferredResult.createdAt,
      caption: image.caption,
      description: image.description,
    }));

    await downloadAssetBundle({
      title: deferredResult.title,
      assets,
    });
  }

  function handleDownloadCopyBundle(format: "txt" | "json") {
    if (!deferredResult?.copyResults?.length) {
      toast.error("当前没有可导出的文案结果。");
      return;
    }

    if (format === "json") {
      downloadBlob(
        new Blob([buildCopyJsonBundle(deferredResult.title, deferredResult.copyResults)], {
          type: "application/json;charset=utf-8",
        }),
        `${deferredResult.title}-文案包.json`,
      );
      return;
    }

    downloadBlob(
      new Blob([buildCopyTextBundle(deferredResult.title, deferredResult.copyResults)], {
        type: "text/plain;charset=utf-8",
      }),
      `${deferredResult.title}-文案包.txt`,
    );
  }

  const uploadHint =
    activeModule === "fashion"
      ? "优先上传干净、无遮挡的服饰图，系统会自动分析版型保护点。"
      : "建议上传干净、无遮挡的商品图。";

  const showProductUploader =
    activeModule === "main" ||
    activeModule === "detail" ||
    activeModule === "style-clone" ||
    activeModule === "fashion" ||
    (activeModule === "commerce" && !isCommerceCopyOnly);

  return (
    <div className="space-y-5">
      <section className="studio-card rounded-[32px] px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[#9a8759]">
              {moduleMeta.badge ?? "Studio"}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#17120d]">
              {moduleMeta.label}工作室
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6f604c]">
              {moduleMeta.description}
            </p>
          </div>
          <div className="rounded-[24px] border border-[#ead8a7] bg-[#fdf5df] px-5 py-4 text-sm leading-7 text-[#7b6328]">
            当前版本的结果图只保存在浏览器本地，请在生成后及时下载。
          </div>
        </div>
      </section>

      {restoreNotice ? (
        <section
          className={cn(
            "rounded-[26px] border px-5 py-4 text-sm leading-7",
            restoreNotice.tone === "success"
              ? "border-[#c6dcb7] bg-[#f4fbef] text-[#476335]"
              : "border-[#ead8a7] bg-[#fdf5df] text-[#7b6328]",
          )}
        >
          {restoreNotice.message}
        </section>
      ) : null}

      <div className="studio-grid">
        <section className="space-y-4">
          <section className="studio-card rounded-[28px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#17120d]">工作模式</p>
                <p className="mt-1 text-xs leading-5 text-[#7b6b56]">
                  不同模式会影响隐藏提示词结构、输入要求和结果呈现。
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-[#a78c49]" />
            </div>
            <div className="flex flex-wrap gap-2">
              {MODULE_WORKFLOW_OPTIONS[activeModule].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setWorkflowMode(option)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium",
                    workflowMode === option
                      ? "bg-[#17120d] text-[#f9f5ea]"
                      : "border border-black/10 bg-white text-[#584b37]",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          {activeModule === "detail" ? (
            <section className="studio-card rounded-[28px] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#17120d]">详情图主题（可多选）</p>
                  <p className="mt-1 text-xs leading-5 text-[#7b6b56]">
                    已选几个主题，就会按主题分别生成对应的详情图。
                  </p>
                </div>
                <span className="rounded-full bg-[#f3ebdb] px-3 py-1 text-[11px] font-medium text-[#8d7740]">
                  {detailFocusIds.length} 项
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {DETAIL_FOCUS_PRESETS.map((preset) => (
                  <SelectableCard
                    key={preset.id}
                    selected={detailFocusIds.includes(preset.id)}
                    title={preset.label}
                    description={preset.description}
                    badge={preset.shortLabel}
                    onClick={() => toggleDetailFocus(preset.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {activeModule === "fashion" ? (
            <section className="studio-card rounded-[28px] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#17120d]">服饰类型</p>
                  <p className="mt-1 text-xs leading-5 text-[#7b6b56]">
                    当前优先把上衣和下装试穿做稳，连体服和换上下装后续再补。
                  </p>
                </div>
                <Layers3 className="h-4 w-4 text-[#a78c49]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {FASHION_GARMENT_PRESETS.map((preset) => (
                  <SelectableCard
                    key={preset.id}
                    selected={garmentCategory === preset.label}
                    title={preset.label}
                    description={preset.description}
                    onClick={() => setGarmentCategory(preset.label)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {showProductUploader ? (
            <UploadCard
              title={activeModule === "fashion" ? "上传服饰图" : "上传产品图"}
              hint={uploadHint}
              files={productImages}
              onChange={setProductImages}
              maxFiles={activeModule === "style-clone" ? 2 : 6}
            />
          ) : null}

          {activeModule === "style-clone" ? (
            <UploadCard
              title="上传参考风格图"
              hint="建议上传 1-4 张目标风格参考图，系统会先分析布光、构图、背景和情绪。"
              files={referenceImages}
              onChange={setReferenceImages}
              maxFiles={4}
            />
          ) : null}

          {activeModule === "retouch" ? (
            <UploadCard
              title="上传待精修图片"
              hint="适合修改已有图片，比如补光、换背景、提高清晰度和处理瑕疵。"
              files={sourceImages}
              onChange={setSourceImages}
              maxFiles={4}
            />
          ) : null}

          {activeModule === "fashion" ? (
            <>
              <UploadCard
                title={`上传模特图${isFashionModelRequired(workflowMode) ? "（必传）" : "（可选）"}`}
                hint={
                  isFashionModelRequired(workflowMode)
                    ? "当前模式需要模特图，系统会尽量保留人物身份和镜头氛围。"
                    : "服装平铺模式可以不上传模特图。"
                }
                files={modelImages}
                onChange={setModelImages}
                multiple={false}
                maxFiles={1}
              />
              {garmentCategory === "上衣" &&
              (workflowMode === "上身试穿" || workflowMode === "一键换装") ? (
                <UploadCard
                  title="上传内搭图（可选）"
                  hint="如果模特本身有内搭或叠穿需求，可以一并上传，系统会更好处理层次。"
                  files={innerLayerImages}
                  onChange={setInnerLayerImages}
                  multiple={false}
                  maxFiles={1}
                />
              ) : null}
            </>
          ) : null}

          <section className="studio-card rounded-[28px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#17120d]">提示词与额外要求</p>
                <p className="mt-1 text-xs leading-5 text-[#7b6b56]">{moduleMeta.helper}</p>
              </div>
              <WandSparkles className="h-4 w-4 text-[#a78c49]" />
            </div>

            {(activeModule === "style-clone" || activeModule === "fashion") && (
              <div className="mb-4 rounded-[22px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-4 text-sm leading-7 text-[#7b6328]">
                {activeModule === "style-clone"
                  ? "系统会先分析参考图的布光、构图、背景和整体情绪，再把这些隐藏风格指令合并进生成提示词。"
                  : "系统会先分析服饰的版型、长度、印花和必须保护的细节，再合并到服装试穿提示词里。"}
              </div>
            )}

            <div className="grid gap-3">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="描述你想要的画面、构图、氛围、平台感和商品重点。"
                className="min-h-[140px] rounded-[24px] border border-black/10 bg-[#faf7f1] px-4 py-4 text-sm leading-7 outline-none transition-colors focus:border-[#caa64c]"
              />
              <textarea
                value={extraNotes}
                onChange={(event) => setExtraNotes(event.target.value)}
                placeholder="补充要求，例如保留 logo、不改产品颜色、裙长到小腿、换姿势但保持正脸等。"
                className="min-h-[96px] rounded-[24px] border border-black/10 bg-white px-4 py-4 text-sm leading-7 outline-none transition-colors focus:border-[#caa64c]"
              />
              {(activeModule === "commerce" ||
                activeModule === "detail" ||
                activeModule === "style-clone") && (
                <textarea
                  value={productFacts}
                  onChange={(event) => setProductFacts(event.target.value)}
                  placeholder="补充商品事实：材质、卖点、规格、人群、价格带、使用场景等。"
                  className="min-h-[96px] rounded-[24px] border border-black/10 bg-white px-4 py-4 text-sm leading-7 outline-none transition-colors focus:border-[#caa64c]"
                />
              )}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {MODULE_PROMPT_TEMPLATES[activeModule].map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => applyTemplate(template.prompt)}
                  className="rounded-[18px] border border-black/8 bg-white px-4 py-3 text-left text-sm text-[#5c4e3b] transition-colors hover:bg-[#faf1df]"
                >
                  <p className="font-medium text-[#17120d]">{template.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#7b6b56]">{template.prompt}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="studio-card rounded-[28px] p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#2e271d]">适配平台</span>
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as PlatformTarget)}
                  className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                >
                  {PLATFORM_TARGETS.map((target) => (
                    <option key={target} value={target}>
                      {target}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#2e271d]">画面比例</span>
                <select
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}
                  className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                >
                  {aspectRatioOptions.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#2e271d]">图片尺寸</span>
                <select
                  value={imageSize}
                  onChange={(event) => setImageSize(event.target.value as ImageSize)}
                  className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                >
                  {imageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              {activeModule === "commerce" ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#2e271d]">批量数量</span>
                  <select
                    value={batchCount}
                    onChange={(event) => setBatchCount(Number(event.target.value))}
                    className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value} 组
                      </option>
                    ))}
                  </select>
                </label>
              ) : activeModule === "detail" ? (
                <div className="rounded-[24px] border border-black/8 bg-[#faf7f1] px-4 py-4 text-sm leading-7 text-[#5c4e3b]">
                  已选 {selectedDetailFocuses.length || 1} 个详情图主题，系统会按主题分别出图。
                </div>
              ) : (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#2e271d]">生成数量</span>
                  <select
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                    className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                  >
                    {[1, 2, 3, 4].map((value) => (
                      <option key={value} value={value}>
                        {value} 张
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {activeModule === "commerce" && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#2e271d]">文案语气</span>
                  <input
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                  />
                </label>
                <div className="rounded-[24px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-4 text-sm leading-7 text-[#7b6328]">
                  当前带货文案批量并发限制为 5，适合做平台标题、标签、CTA 和镜头角度测试。
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {QUALITY_MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setQualityMode(option.id)}
                  className={cn(
                    "rounded-[20px] px-4 py-3 text-left",
                    qualityMode === option.id
                      ? "bg-[#17120d] text-[#f9f5ea]"
                      : "border border-black/10 bg-white text-[#584b37]",
                  )}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      qualityMode === option.id ? "text-[#d7ccb1]" : "text-[#7b6b56]",
                    )}
                  >
                    {option.description}
                  </p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQualityMode("speed")}
                hidden
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  qualityMode === "speed"
                    ? "bg-[#17120d] text-[#f9f5ea]"
                    : "border border-black/10 bg-white text-[#584b37]",
                )}
              >
                默认速度
              </button>
              <button
                type="button"
                onClick={() => setQualityMode("hq")}
                hidden
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  qualityMode === "hq"
                    ? "bg-[#17120d] text-[#f9f5ea]"
                    : "border border-black/10 bg-white text-[#584b37]",
                )}
              >
                高质量模式
              </button>
              <div className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm text-[#6f604c]">
                本次预计输出：{expectedImageCount} 张图
                {activeModule === "commerce" ? ` / ${batchCount} 组文案` : ""}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGenerateSafe}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-[#17120d] px-6 py-4 text-sm font-medium text-[#f9f5ea] transition-opacity hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  正在生成...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始生成
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleResetWorkspace}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-3 rounded-full border border-black/10 bg-white px-6 py-4 text-sm font-medium text-[#4b4030] transition-colors hover:bg-[#f8f1e3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              清空当前工作台
            </button>
            <p className="rounded-[22px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-4 text-sm leading-7 text-[#7b6328]">
              结果图暂不长期保存，请在生成完成后立即下载。后续版本会补 Supabase Storage / R2 持久化。
            </p>
          </div>
        </section>

        <section className="studio-card min-h-[760px] rounded-[32px] p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-black/6 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#17120d]">生成结果</p>
                <p className="mt-1 text-xs leading-5 text-[#7b6b56]">
                  图片支持点击放大，建议在结果区直接下载或批量打包下载。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {deferredResult?.images.length ? (
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                  >
                    <Download className="h-4 w-4" />
                    下载全部
                  </button>
                ) : null}
                {deferredResult?.copyResults?.length ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        copyTextToClipboard(
                          buildCopyTextBundle(
                            deferredResult.title,
                            deferredResult.copyResults ?? [],
                          ),
                          "文案包已复制到剪贴板。",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                    >
                      <Copy className="h-4 w-4" />
                      复制文案包
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCopyBundle("txt")}
                      className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                    >
                      <FileText className="h-4 w-4" />
                      下载 TXT
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCopyBundle("json")}
                      className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                    >
                      <FileJson2 className="h-4 w-4" />
                      下载 JSON
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {deferredResult ? (
              <div className="grid gap-3 md:grid-cols-3">
                {resultMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-[22px] border border-black/8 bg-[#faf7f1] px-4 py-4"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-[#9b8970]">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#17120d]">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {isGenerating && generationStatusText ? (
              <div className="rounded-[22px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-3 text-sm text-[#7b6328]">
                当前正在分批回传结果：{generationStatusText}
              </div>
            ) : null}
          </div>

          {!deferredResult && isGenerating ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f3ebdb] text-[#a88a43]">
                <LoaderCircle className="h-7 w-7 animate-spin" />
              </div>
              <h2 className="mt-6 text-xl font-semibold text-[#17120d]">
                正在调用 Gemini 生成结果
              </h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-[#6f604c]">
                系统会保留当前输入参数，生成成功后自动写入本地历史。请不要关闭页面。
              </p>
            </div>
          ) : deferredResult ? (
            <div className="pt-5">
              <div className="mb-5 rounded-[24px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-4 text-sm leading-7 text-[#7b6328]">
                {deferredResult.images.length
                  ? "请立即下载生成结果。当前阶段图片仅保存在浏览器本地缓存中，清理缓存或更换设备后可能无法恢复。"
                  : "当前模式主要输出文案与视频预备内容。若需要图片，请切回图文带货模式。"}
              </div>

              {deferredResult.notes ? (
                <div className="mb-5 rounded-[24px] border border-black/8 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-[#17120d]">系统分析与隐藏提示词摘要</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5a4c39]">
                    {deferredResult.notes}
                  </p>
                </div>
              ) : null}

              <ResultImageGrid
                images={displayImages}
                title={deferredResult.title}
                onPreview={setLightboxIndex}
              />

              <CopyResultsSection
                copyResults={deferredResult.copyResults ?? []}
                onCopy={(copyItem) =>
                  copyTextToClipboard(
                    buildCopyTextBundle(copyItem.title, [copyItem]),
                    "单条文案已复制到剪贴板。",
                  )
                }
              />
            </div>
          ) : (
            <div className="space-y-6 pt-5">
              <div className="rounded-[24px] border border-black/8 bg-white px-5 py-5">
                <h2 className="text-2xl font-semibold tracking-tight text-[#17120d]">
                  从这里开始你的商品创意生成
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6f604c]">
                  上传素材、填写提示词并点击生成。当前版本不做套餐和积分展示，先把每个工作台的生成逻辑做完整。
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#faf7f1] px-4 py-2 text-sm text-[#5c4e3b]">
                    <Images className="h-4 w-4" />
                    预置隐藏提示词
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#faf7f1] px-4 py-2 text-sm text-[#5c4e3b]">
                    <Layers3 className="h-4 w-4" />
                    风格/服装自动分析
                  </div>
                </div>
              </div>

              <InspirationBoard module={activeModule} />

              <div className="rounded-[24px] border border-black/8 bg-white px-5 py-4 text-sm text-[#5b4c39]">
                没有配置 Key？先去
                <Link href="/settings" className="mx-1 font-semibold text-[#8d7740]">
                  设置页
                </Link>
                填写 Gemini API URL 和 API Key。
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[#ead8a7] bg-[#fdf5df] px-4 py-2 text-sm text-[#7b6328]">
                <AlertTriangle className="h-4 w-4" />
                所有结果图生成后请立即下载
              </div>
            </div>
          )}
        </section>
      </div>

      <ImageLightbox
        images={displayImages}
        openIndex={lightboxIndex}
        onOpenIndexChange={setLightboxIndex}
      />
    </div>
  );
}
