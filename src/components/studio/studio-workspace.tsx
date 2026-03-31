"use client";

import {
  AlertTriangle,
  Copy,
  Download,
  FileJson2,
  FileText,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useSupabaseAuth } from "@/components/providers/auth-provider";
import { UploadCard } from "@/components/shared/upload-card";
import { ImageLightbox } from "@/components/studio/image-lightbox";
import { STUDIO_NAV_ITEMS } from "@/config/studio";
import {
  buildCopyJsonBundle,
  buildCopyTextBundle,
  downloadAssetBundle,
  downloadBlob,
  downloadDataUrl,
} from "@/lib/studio/exporters";
import {
  createInputAssetRecords,
  groupInputAssetFiles,
} from "@/lib/studio/local-assets";
import { nnbDb } from "@/lib/storage/db";
import { getAssetsByIds, saveAssets, saveJob } from "@/lib/storage/jobs";
import { base64ToBlob } from "@/lib/utils/data-url";
import { useSettingsStore } from "@/stores/settings-store";
import type {
  AspectRatio,
  CommerceCopyResult,
  GenerateStudioResponse,
  ImageSize,
  LocalAssetRecord,
  LocalJobRecord,
  PlatformTarget,
  QualityMode,
  StudioModule,
} from "@/types/studio";
import { ASPECT_RATIOS, IMAGE_SIZES, PLATFORM_TARGETS } from "@/types/studio";

const DEFAULT_TONE = "专业但不生硬";
const DEFAULT_GARMENT_CATEGORY = "上装";
const DEFAULT_PLATFORM: PlatformTarget = "通用电商";

const promptTemplates: Record<StudioModule, string[]> = {
  main: ["高级棚拍主图", "自然光场景主图", "平台爆款首图", "白底高转化主图"],
  detail: ["功能卖点图", "材质细节图", "使用场景图", "参数说明图"],
  "style-clone": ["延续参考图布光", "复刻杂志感", "统一系列视觉", "加强品牌气质"],
  retouch: ["去背景补光", "提高清晰度", "优化包装反光", "统一视觉色温"],
  fashion: ["模特上身试穿", "一键换装", "服装平铺展示", "换姿势重新出图"],
  commerce: ["小红书带货套图", "抖音挂车图", "平台标题与标签", "视频分镜预备稿"],
};

const workflowOptions: Record<StudioModule, string[]> = {
  main: ["首图转化", "自然种草", "高级棚拍", "节日促销"],
  detail: ["卖点讲解", "材质特写", "参数说明", "使用场景"],
  "style-clone": ["轻复刻", "标准复刻", "强风格复刻"],
  retouch: ["去背景", "补光修瑕", "换背景", "局部重绘"],
  fashion: ["上身试穿", "一键换装", "服装平铺", "换姿势"],
  commerce: ["图文带货", "批量文案", "视频预备"],
};

function getDefaultWorkflowMode(module: StudioModule) {
  return workflowOptions[module][0];
}

interface RestoreNotice {
  tone: "success" | "warning";
  message: string;
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
  const [platform, setPlatform] = useState<PlatformTarget>(DEFAULT_PLATFORM);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(settings.defaultAspectRatio);
  const [imageSize, setImageSize] = useState<ImageSize>(settings.defaultImageSize);
  const [count, setCount] = useState(1);
  const [batchCount, setBatchCount] = useState(3);
  const [qualityMode, setQualityMode] = useState<QualityMode>("speed");
  const [restoreNotice, setRestoreNotice] = useState<RestoreNotice | null>(null);
  const [result, setResult] = useState<GenerateStudioResponse["job"] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const deferredResult = useDeferredValue(result);
  const isCommerceCopyOnly =
    activeModule === "commerce" &&
    (workflowMode === "批量文案" || workflowMode === "视频预备");

  const displayImages = useMemo(
    () =>
      deferredResult?.images.map((image, index) => ({
        src: `data:${image.mimeType};base64,${image.base64Data}`,
        alt: `${deferredResult.title}-${index + 1}`,
      })) ?? [],
    [deferredResult],
  );

  const resultMetrics = useMemo(
    () => [
      { label: "图片结果", value: `${deferredResult?.images.length ?? 0} 张` },
      { label: "文案结果", value: `${deferredResult?.copyResults?.length ?? 0} 组` },
      { label: "当前模式", value: workflowMode },
    ],
    [deferredResult, workflowMode],
  );

  function resetUploads() {
    setProductImages([]);
    setReferenceImages([]);
    setSourceImages([]);
    setModelImages([]);
    setInnerLayerImages([]);
  }

  function applyTemplate(template: string) {
    setPrompt((currentPrompt) =>
      currentPrompt ? `${currentPrompt}；${template}` : template,
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
    setPlatform(DEFAULT_PLATFORM);
    setAspectRatio(settings.defaultAspectRatio);
    setImageSize(settings.defaultImageSize);
    setCount(1);
    setBatchCount(3);
    setQualityMode("speed");
    setWorkflowMode(getDefaultWorkflowMode(activeModule));
    setRestoreNotice(null);
    setResult(null);
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
    setPlatform(DEFAULT_PLATFORM);
    setCount(1);
    setBatchCount(3);
    setQualityMode("speed");
    setWorkflowMode(getDefaultWorkflowMode(activeModule));
    setRestoreNotice(null);
    setResult(null);
    setLightboxIndex(null);
  }, [activeModule]);

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
      setAspectRatio(job.aspectRatio);
      setImageSize(job.imageSize);
      setPlatform(job.platform);
      setCount(job.imageCount ?? 1);
      setBatchCount(job.batchCount ?? 3);
      setQualityMode(job.qualityMode ?? "speed");
      setResult(null);
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

    if (
      (activeModule === "main" || activeModule === "detail") &&
      productImages.length === 0
    ) {
      toast.error("请先上传产品图。");
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

    if (activeModule === "fashion" && productImages.length === 0) {
      toast.error("服装模块至少需要上传服装图。");
      return false;
    }

    if (activeModule === "commerce") {
      if (isCommerceCopyOnly) {
        if (!prompt.trim() && !productFacts.trim()) {
          toast.error("批量文案或视频预备模式至少填写提示词或商品事实。");
          return false;
        }
      } else if (productImages.length === 0) {
        toast.error("带货图文模式请先上传产品图。");
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
      aspectRatio,
      imageSize,
      platform,
      imageCount: count,
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
      count,
      batchCount,
      tone,
      garmentCategory,
      imageModel:
        qualityMode === "hq" ? settings.hqImageModel : settings.defaultImageModel,
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
        new Blob(
          [buildCopyJsonBundle(deferredResult.title, deferredResult.copyResults)],
          {
            type: "application/json;charset=utf-8",
          },
        ),
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

  function renderCopyResults(copyResults: CommerceCopyResult[]) {
    return (
      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        {copyResults.map((copyItem) => (
          <article
            key={copyItem.id}
            className="rounded-[26px] border border-black/8 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-[#f3ebdb] px-3 py-1 text-[11px] font-medium text-[#8d7740]">
                {copyItem.platform}
              </span>
              <button
                type="button"
                onClick={() =>
                  copyTextToClipboard(
                    buildCopyTextBundle(copyItem.title, [copyItem]),
                    "单条文案已复制到剪贴板。",
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-medium text-[#5c4e3b] hover:bg-[#faf1df]"
              >
                <Copy className="h-3.5 w-3.5" />
                复制本条
              </button>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#17120d]">
              {copyItem.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#5a4c39]">
              {copyItem.body}
            </p>

            {copyItem.openingLine ? (
              <div className="mt-4 rounded-[18px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-3 text-sm text-[#6f5820]">
                开场钩子：{copyItem.openingLine}
              </div>
            ) : null}

            {copyItem.sellingPoints?.length ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-[#17120d]">卖点结构</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {copyItem.sellingPoints.map((point) => (
                    <span
                      key={point}
                      className="rounded-full border border-black/8 bg-[#faf7f1] px-3 py-1 text-xs text-[#6f604c]"
                    >
                      {point}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {copyItem.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-black/8 bg-[#faf7f1] px-3 py-1 text-xs text-[#6f604c]"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {copyItem.shotList?.length ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-[#17120d]">视频预备分镜</p>
                <ol className="mt-2 space-y-2 text-sm leading-6 text-[#5a4c39]">
                  {copyItem.shotList.map((shot, index) => (
                    <li key={`${copyItem.id}-${index}`}>
                      {index + 1}. {shot}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className="mt-4 rounded-[20px] bg-[#17120d] px-4 py-3 text-sm font-medium text-[#f8f4e7]">
              CTA：{copyItem.cta}
            </div>
          </article>
        ))}
      </section>
    );
  }

  const uploadHint =
    activeModule === "fashion"
      ? "支持上装、下装、连体服等服装图输入。"
      : "建议上传干净、无遮挡的商品图。";

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
          className={`rounded-[26px] border px-5 py-4 text-sm leading-7 ${
            restoreNotice.tone === "success"
              ? "border-[#c6dcb7] bg-[#f4fbef] text-[#476335]"
              : "border-[#ead8a7] bg-[#fdf5df] text-[#7b6328]"
          }`}
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
                  不同模式会影响提示词结构与结果呈现。
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-[#a78c49]" />
            </div>
            <div className="flex flex-wrap gap-2">
              {workflowOptions[activeModule].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setWorkflowMode(option)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    workflowMode === option
                      ? "bg-[#17120d] text-[#f9f5ea]"
                      : "border border-black/10 bg-white text-[#584b37]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          {(activeModule === "main" ||
            activeModule === "detail" ||
            activeModule === "style-clone" ||
            activeModule === "fashion" ||
            (activeModule === "commerce" && !isCommerceCopyOnly)) && (
            <UploadCard
              title={activeModule === "fashion" ? "上传服装图" : "上传产品图"}
              hint={uploadHint}
              files={productImages}
              onChange={setProductImages}
              maxFiles={activeModule === "style-clone" ? 4 : 6}
            />
          )}

          {activeModule === "style-clone" && (
            <UploadCard
              title="上传参考风格图"
              hint="建议上传 1-4 张目标风格参考图，让模型贴近视觉调性。"
              files={referenceImages}
              onChange={setReferenceImages}
              maxFiles={4}
            />
          )}

          {activeModule === "retouch" && (
            <UploadCard
              title="上传待精修图片"
              hint="适合修改已有图片，比如补光、换背景、提清晰度。"
              files={sourceImages}
              onChange={setSourceImages}
              maxFiles={4}
            />
          )}

          {activeModule === "fashion" && (
            <>
              <UploadCard
                title="上传模特图（可选）"
                hint="如果要做上身试穿或一键换装，上传人物图会更稳定。"
                files={modelImages}
                onChange={setModelImages}
                multiple={false}
                maxFiles={1}
              />
              <UploadCard
                title="上传内搭图（可选）"
                hint="有内搭时可一并上传，避免服装叠加关系不自然。"
                files={innerLayerImages}
                onChange={setInnerLayerImages}
                multiple={false}
                maxFiles={1}
              />
            </>
          )}

          <section className="studio-card rounded-[28px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#17120d]">提示词与额外要求</p>
                <p className="mt-1 text-xs leading-5 text-[#7b6b56]">
                  {moduleMeta.helper}
                </p>
              </div>
              <WandSparkles className="h-4 w-4 text-[#a78c49]" />
            </div>

            <div className="grid gap-3">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="描述你想要的画面、构图、氛围、平台感和商品重点..."
                className="min-h-[140px] rounded-[24px] border border-black/10 bg-[#faf7f1] px-4 py-4 text-sm leading-7 outline-none transition-colors focus:border-[#caa64c]"
              />
              <textarea
                value={extraNotes}
                onChange={(event) => setExtraNotes(event.target.value)}
                placeholder="补充要求，例如：保留 logo、不要改产品颜色、裙摆拉长到小腿、换姿势但保持正脸..."
                className="min-h-[96px] rounded-[24px] border border-black/10 bg-white px-4 py-4 text-sm leading-7 outline-none transition-colors focus:border-[#caa64c]"
              />
              {(activeModule === "commerce" || activeModule === "detail") && (
                <textarea
                  value={productFacts}
                  onChange={(event) => setProductFacts(event.target.value)}
                  placeholder="补充商品事实：材质、卖点、规格、人群、价格带、使用场景..."
                  className="min-h-[96px] rounded-[24px] border border-black/10 bg-white px-4 py-4 text-sm leading-7 outline-none transition-colors focus:border-[#caa64c]"
                />
              )}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {promptTemplates[activeModule].map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="rounded-[18px] border border-black/8 bg-white px-4 py-3 text-left text-sm text-[#5c4e3b] transition-colors hover:bg-[#faf1df]"
                >
                  {template}
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
                  {ASPECT_RATIOS.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#2e271d]">出图尺寸</span>
                <select
                  value={imageSize}
                  onChange={(event) => setImageSize(event.target.value as ImageSize)}
                  className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                >
                  {IMAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#2e271d]">
                  {activeModule === "commerce" && isCommerceCopyOnly ? "文案组数" : "生成数量"}
                </span>
                <input
                  type="number"
                  min={1}
                  max={activeModule === "commerce" && isCommerceCopyOnly ? 5 : 4}
                  value={activeModule === "commerce" && isCommerceCopyOnly ? batchCount : count}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value) || 1;
                    if (activeModule === "commerce" && isCommerceCopyOnly) {
                      setBatchCount(Math.min(5, Math.max(1, nextValue)));
                    } else {
                      setCount(Math.min(4, Math.max(1, nextValue)));
                    }
                  }}
                  className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                />
              </label>

              {activeModule === "commerce" && (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#2e271d]">平台语气</span>
                  <input
                    type="text"
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                  />
                </label>
              )}

              {activeModule === "fashion" && (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#2e271d]">服装类型</span>
                  <select
                    value={garmentCategory}
                    onChange={(event) => setGarmentCategory(event.target.value)}
                    className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
                  >
                    <option value="上装">上装</option>
                    <option value="下装">下装</option>
                    <option value="连体服">连体服</option>
                    <option value="套装">套装</option>
                    <option value="外套">外套</option>
                  </select>
                </label>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setQualityMode("speed")}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  qualityMode === "speed"
                    ? "bg-[#17120d] text-[#f9f5ea]"
                    : "border border-black/10 bg-white text-[#584b37]"
                }`}
              >
                默认速度
              </button>
              <button
                type="button"
                onClick={() => setQualityMode("hq")}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  qualityMode === "hq"
                    ? "bg-[#17120d] text-[#f9f5ea]"
                    : "border border-black/10 bg-white text-[#584b37]"
                }`}
              >
                高质量模式
              </button>
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-[#17120d] px-6 py-4 text-sm font-medium text-[#f9f5ea] transition-opacity hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
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
              disabled={isPending}
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
          </div>

          {isPending ? (
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
                  <p className="text-sm font-semibold text-[#17120d]">AI 补充说明</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5a4c39]">
                    {deferredResult.notes}
                  </p>
                </div>
              ) : null}

              {displayImages.length ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {displayImages.map((image, index) => (
                    <article
                      key={`${image.alt}-${index}`}
                      className="overflow-hidden rounded-[28px] border border-black/8 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        className="block w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.src}
                          alt={image.alt}
                          className="aspect-[4/5] w-full object-cover"
                        />
                      </button>
                      <div className="flex items-center justify-between gap-3 p-4">
                        <div>
                          <p className="text-sm font-semibold text-[#17120d]">
                            {deferredResult.title}
                          </p>
                          <p className="mt-1 text-xs text-[#7b6b56]">
                            点击图片查看大图
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            downloadDataUrl(
                              image.src,
                              `${deferredResult.title}-${index + 1}.png`,
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#faf7f1] px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f4ebd9]"
                        >
                          <Download className="h-4 w-4" />
                          下载
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {deferredResult.copyResults?.length
                ? renderCopyResults(deferredResult.copyResults)
                : null}
            </div>
          ) : (
            <div className="flex min-h-[620px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f3ebdb] text-[#a88a43]">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold tracking-tight text-[#17120d]">
                从这里开始你的商品创意生成
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-7 text-[#6f604c]">
                上传素材、填写提示词并点击生成。当前版本不做套餐和积分展示，先把产品链路与生成质量做到可用。
              </p>
              <div className="mt-5 rounded-[24px] border border-black/8 bg-white px-5 py-4 text-sm text-[#5b4c39]">
                没有配置 Key？先去
                <Link href="/settings" className="mx-1 font-semibold text-[#8d7740]">
                  设置页
                </Link>
                填写 Gemini API Key。
              </div>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#ead8a7] bg-[#fdf5df] px-4 py-2 text-sm text-[#7b6328]">
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
