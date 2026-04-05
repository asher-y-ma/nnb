"use client";

import {
  AlertTriangle,
  Copy,
  Download,
  FileJson2,
  FileText,
  LoaderCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ImageLightbox } from "@/components/studio/image-lightbox";
import {
  CopyResultsSection,
  ResultImageGrid,
} from "@/components/studio/workspace-sections";
import { DETAIL_FOCUS_PRESETS } from "@/lib/studio/workflow-presets";
import {
  buildCopyJsonBundle,
  buildCopyTextBundle,
  downloadAssetBundle,
  downloadBlob,
} from "@/lib/studio/exporters";
import { cn } from "@/lib/utils/cn";
import { base64ToBlob } from "@/lib/utils/data-url";
import type {
  AspectRatio,
  CommerceCopyResult,
  DetailFocusId,
  GenerationProgressTotals,
  ImageSize,
  ImageTextLanguage,
  LocalAssetRecord,
  PlatformTarget,
  QualityMode,
  StudioJobResult,
  StudioModule,
} from "@/types/studio";

export type StudioGenerationTaskStatus = "queued" | "running" | "completed" | "failed";

/** Frozen copy of form + files at enqueue time. */
export interface StudioGenerationSnapshot {
  module: StudioModule;
  workflowMode: string;
  prompt: string;
  extraNotes: string;
  productFacts: string;
  tone: string;
  garmentCategory: string;
  detailFocusIds: DetailFocusId[];
  platform: PlatformTarget;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  count: number;
  batchCount: number;
  imageTextLanguage: ImageTextLanguage;
  qualityMode: QualityMode;
  imageModel: string;
  textModel: string;
  apiBaseUrl: string;
  apiKey: string;
  productImages: File[];
  referenceImages: File[];
  sourceImages: File[];
  modelImages: File[];
  innerLayerImages: File[];
}

export interface StudioGenerationTask {
  id: string;
  status: StudioGenerationTaskStatus;
  snapshot: StudioGenerationSnapshot;
  result: StudioJobResult | null;
  generationTotals: GenerationProgressTotals | null;
  error: string | null;
  createdAt: number;
}

function statusLabel(status: StudioGenerationTaskStatus) {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "生成中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

function generationStatusText(
  totals: GenerationProgressTotals | null,
  result: StudioJobResult | null,
) {
  if (!totals) {
    return "";
  }

  const imageProgress = `${result?.images.length ?? 0}/${totals.images} 张图`;
  const copyProgress = totals.copyResults
    ? `${result?.copyResults?.length ?? 0}/${totals.copyResults} 组文案`
    : "";

  return [imageProgress, copyProgress].filter(Boolean).join(" / ");
}

export function StudioGenerationTaskCard({
  task,
  onCopyText,
}: {
  task: StudioGenerationTask;
  onCopyText: (text: string, successMessage: string) => Promise<void>;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { snapshot, status, result, generationTotals, error } = task;

  const isCommerceCopyOnly =
    snapshot.module === "commerce" &&
    (snapshot.workflowMode === "批量文案" || snapshot.workflowMode === "视频预备");

  const selectedDetailFocuses = useMemo(
    () =>
      snapshot.detailFocusIds
        .map((id) => DETAIL_FOCUS_PRESETS.find((preset) => preset.id === id))
        .filter((preset): preset is (typeof DETAIL_FOCUS_PRESETS)[number] => Boolean(preset)),
    [snapshot.detailFocusIds],
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
      { label: "图片结果", value: `${result?.images.length ?? 0} 张` },
      { label: "文案结果", value: `${result?.copyResults?.length ?? 0} 组` },
      {
        label: snapshot.module === "detail" ? "详情主题" : "当前模式",
        value:
          snapshot.module === "detail"
            ? `${selectedDetailFocuses.length || 1} 项`
            : snapshot.workflowMode,
      },
    ],
    [result, selectedDetailFocuses.length, snapshot.module, snapshot.workflowMode],
  );

  const progressText = generationStatusText(generationTotals, result);

  async function handleDownloadAll() {
    if (!result?.images.length) {
      return;
    }

    const assets: LocalAssetRecord[] = result.images.map((image, index) => ({
      id: image.id,
      kind: "output",
      name: `${result.title}-${index + 1}.png`,
      mimeType: image.mimeType,
      size: image.base64Data.length,
      blob: base64ToBlob(image.base64Data, image.mimeType),
      createdAt: result.createdAt,
      caption: image.caption,
      description: image.description,
    }));

    await downloadAssetBundle({
      title: result.title,
      assets,
    });
  }

  function handleDownloadCopyBundle(format: "txt" | "json") {
    if (!result?.copyResults?.length) {
      return;
    }

    if (format === "json") {
      downloadBlob(
        new Blob([buildCopyJsonBundle(result.title, result.copyResults)], {
          type: "application/json;charset=utf-8",
        }),
        `${result.title}-文案包.json`,
      );
      return;
    }

    downloadBlob(
      new Blob([buildCopyTextBundle(result.title, result.copyResults)], {
        type: "text/plain;charset=utf-8",
      }),
      `${result.title}-文案包.txt`,
    );
  }

  return (
    <article
      className={cn(
        "rounded-[28px] border p-5 sm:p-6",
        status === "failed"
          ? "border-[#efc2c2] bg-[#fffdfb]"
          : status === "completed"
            ? "border-[#c6dcb7]/60 bg-white"
            : "border-black/8 bg-white",
      )}
    >
      <div className="flex flex-col gap-3 border-b border-black/6 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
              status === "queued" && "bg-[#f3ebdb] text-[#8d7740]",
              status === "running" && "bg-[#fdf5df] text-[#7b6328]",
              status === "completed" && "bg-[#e8f4e0] text-[#476335]",
              status === "failed" && "bg-[#fde8e8] text-[#8b2f2f]",
            )}
          >
            {status === "running" ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : null}
            {statusLabel(status)}
          </span>
          <span className="text-xs text-[#7b6b56]">
            {new Date(task.createdAt).toLocaleTimeString()} ·{" "}
            {snapshot.module === "commerce" && isCommerceCopyOnly
              ? "文案 / 视频预备"
              : `预计 ${snapshot.module === "detail" ? Math.max(1, snapshot.detailFocusIds.length) : isCommerceCopyOnly ? 0 : snapshot.count} 张图`}
            {snapshot.module === "commerce" ? ` · ${snapshot.batchCount} 组文案` : ""}
            {snapshot.prompt ? ` · ${snapshot.prompt}` : ""}
          </span>
        </div>

        {status === "completed" && result ? (
          <div className="flex flex-wrap gap-2">
            {result.images.length ? (
              <button
                type="button"
                onClick={() => void handleDownloadAll()}
                className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#faf7f1] px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
              >
                <Download className="h-4 w-4" />
                下载全部
              </button>
            ) : null}
            {result.copyResults?.length ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void onCopyText(
                      buildCopyTextBundle(result.title, result.copyResults ?? []),
                      "文案包已复制到剪贴板。",
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#faf7f1] px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                >
                  <Copy className="h-4 w-4" />
                  复制文案包
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCopyBundle("txt")}
                  className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#faf7f1] px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                >
                  <FileText className="h-4 w-4" />
                  下载 TXT
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCopyBundle("json")}
                  className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#faf7f1] px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                >
                  <FileJson2 className="h-4 w-4" />
                  下载 JSON
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {status === "failed" && error ? (
        <div className="mt-4 flex items-start gap-3 rounded-[22px] border border-[#efc2c2] bg-[#fff3f1] px-4 py-3 text-sm text-[#8b2f2f]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="whitespace-pre-wrap break-words">{error}</p>
        </div>
      ) : null}

      {status === "queued" ? (
        <div className="mt-4 rounded-[22px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-3 text-sm text-[#7b6328]">
          任务在队列中，最多同时运行 5 个生成任务。
        </div>
      ) : null}

      {status === "running" && progressText ? (
        <div className="mt-4 rounded-[22px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-3 text-sm text-[#7b6328]">
          正在分批回传结果：{progressText}
        </div>
      ) : null}

      {status === "running" && !result ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f3ebdb] text-[#a88a43]">
            <LoaderCircle className="h-6 w-6 animate-spin" />
          </div>
          <p className="mt-4 text-sm font-medium text-[#17120d]">正在连接生成服务…</p>
        </div>
      ) : null}

      {result && (status === "running" || status === "completed") ? (
        <div className="pt-5">
          {status === "completed" ? (
            <>
              <div className="mb-5 grid gap-3 md:grid-cols-3">
                {resultMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-[22px] border border-black/8 bg-[#faf7f1] px-4 py-4"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-[#9b8970]">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#17120d]">{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="mb-5 rounded-[24px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-4 text-sm leading-7 text-[#7b6328]">
                {result.images.length
                  ? `请立即下载生成结果。图片尺寸：${snapshot.imageSize}。当前阶段图片仅保存在浏览器本地缓存中，清理缓存或更换设备后可能无法恢复。`
                  : "当前模式主要输出文案与视频预备内容。若需要图片，请切回图文带货模式。"}
              </div>
            </>
          ) : (
            <div className="mb-4 rounded-[22px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-3 text-xs text-[#7b6328]">
              生成进行中，结果会陆续出现。
            </div>
          )}

          {result.notes ? (
            <div className="mb-5 rounded-[24px] border border-black/8 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-[#17120d]">系统分析与隐藏提示词摘要</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#5a4c39]">
                {result.notes}
              </p>
            </div>
          ) : null}

          <ResultImageGrid
            images={displayImages}
            title={result.title || "生成中"}
            onPreview={setLightboxIndex}
          />

          <CopyResultsSection
            copyResults={result.copyResults ?? []}
            onCopy={(copyItem: CommerceCopyResult) =>
              void onCopyText(
                buildCopyTextBundle(copyItem.title, [copyItem]),
                "单条文案已复制到剪贴板。",
              )
            }
          />
        </div>
      ) : null}

      <ImageLightbox
        images={displayImages}
        openIndex={lightboxIndex}
        onOpenIndexChange={setLightboxIndex}
      />
    </article>
  );
}
