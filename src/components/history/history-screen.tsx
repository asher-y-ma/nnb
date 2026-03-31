"use client";

import { useLiveQuery } from "dexie-react-hooks";
import dayjs from "dayjs";
import {
  Copy,
  Download,
  FileJson2,
  FileText,
  Images,
  RefreshCcw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ImageLightbox } from "@/components/studio/image-lightbox";
import { STUDIO_NAV_ITEMS } from "@/config/studio";
import {
  buildCopyJsonBundle,
  buildCopyTextBundle,
  downloadAssetBundle,
  downloadBlob,
} from "@/lib/studio/exporters";
import { nnbDb } from "@/lib/storage/db";
import { getAssetsByIds } from "@/lib/storage/jobs";
import type { LocalAssetRecord, LocalJobRecord, StudioModule } from "@/types/studio";

const MODULE_LABEL_MAP = Object.fromEntries(
  STUDIO_NAV_ITEMS.map((item) => [item.id, item.label]),
) as Record<StudioModule, string>;

function HistoryCard({ job }: { job: LocalJobRecord }) {
  const assetState = useLiveQuery(async () => {
    const [outputAssets, inputAssets] = await Promise.all([
      job.outputAssetIds.length ? getAssetsByIds(job.outputAssetIds) : Promise.resolve([]),
      job.inputAssetIds.length ? getAssetsByIds(job.inputAssetIds) : Promise.resolve([]),
    ]);

    return {
      outputAssets: outputAssets.filter(
        (asset): asset is LocalAssetRecord => asset !== undefined && asset !== null,
      ),
      availableInputCount: inputAssets.filter(
        (asset) => asset !== undefined && asset !== null,
      ).length,
    };
  }, [job.id]);

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const lightboxImages = useMemo(
    () =>
      assetState?.outputAssets.map((asset) => ({
        src: URL.createObjectURL(asset.blob),
        alt: asset.name,
      })) ?? [],
    [assetState],
  );

  useEffect(() => {
    return () => {
      lightboxImages.forEach((image) => URL.revokeObjectURL(image.src));
    };
  }, [lightboxImages]);

  const moduleLabel = MODULE_LABEL_MAP[job.module] ?? job.module;
  const previewImage = lightboxImages[0];
  const availableOutputCount = assetState?.outputAssets.length ?? 0;
  const availableInputCount = assetState?.availableInputCount ?? 0;
  const hasFullInputCache =
    job.inputAssetIds.length > 0 && availableInputCount === job.inputAssetIds.length;
  const hasPartialInputCache =
    availableInputCount > 0 && availableInputCount < job.inputAssetIds.length;

  async function copyBundleToClipboard() {
    if (!job.textResults?.length) {
      toast.error("这个任务没有可复制的文案结果。");
      return;
    }

    try {
      await navigator.clipboard.writeText(buildCopyTextBundle(job.title, job.textResults));
      toast.success("文案包已复制到剪贴板。");
    } catch {
      toast.error("复制失败，请检查浏览器权限。");
    }
  }

  async function downloadResults() {
    if (!assetState?.outputAssets.length) {
      toast.error("当前设备没有这条历史的本地结果图。");
      return;
    }

    await downloadAssetBundle({
      title: job.title,
      assets: assetState.outputAssets,
    });
  }

  function downloadCopyBundle(format: "txt" | "json") {
    if (!job.textResults?.length) {
      toast.error("这个任务没有可导出的文案结果。");
      return;
    }

    if (format === "json") {
      downloadBlob(
        new Blob([buildCopyJsonBundle(job.title, job.textResults)], {
          type: "application/json;charset=utf-8",
        }),
        `${job.title}-文案包.json`,
      );
      return;
    }

    downloadBlob(
      new Blob([buildCopyTextBundle(job.title, job.textResults)], {
        type: "text/plain;charset=utf-8",
      }),
      `${job.title}-文案包.txt`,
    );
  }

  return (
    <article className="studio-card rounded-[28px] p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="h-44 w-full overflow-hidden rounded-[22px] border border-black/8 bg-[#f5efe3] sm:max-w-[240px]">
          {previewImage ? (
            <button
              type="button"
              onClick={() => setOpenIndex(0)}
              className="h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.src}
                alt={job.title}
                className="h-full w-full object-cover"
              />
            </button>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#8d7d65]">
              当前设备无本地预览
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#f3ebdb] px-3 py-1 text-[11px] font-medium text-[#8d7740]">
                {moduleLabel}
              </span>
              {job.workflowMode ? (
                <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] text-[#7b6b56]">
                  {job.workflowMode}
                </span>
              ) : null}
              <span className="text-xs text-[#7b6b56]">
                {dayjs(job.createdAt).format("YYYY-MM-DD HH:mm")}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-[#17120d]">
              {job.title}
            </h2>
            <p className="mt-2 line-clamp-3 text-sm leading-7 text-[#6f604c]">
              {job.prompt}
            </p>
            {job.notes ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#8a765c]">
                AI 备注：{job.notes}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-[#5c4e3b]">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2">
              <Images className="h-4 w-4" />
              {availableOutputCount}/{job.outputAssetIds.length} 张结果图
            </span>
            {job.textResults?.length ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2">
                文案 {job.textResults.length} 组
              </span>
            ) : null}
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${
                hasFullInputCache
                  ? "border border-[#c6dcb7] bg-[#f4fbef] text-[#476335]"
                  : "border border-[#ead8a7] bg-[#fdf6df] text-[#7c6325]"
              }`}
            >
              {hasFullInputCache
                ? `可恢复 ${availableInputCount} 张本地素材`
                : hasPartialInputCache
                  ? `已恢复 ${availableInputCount}/${job.inputAssetIds.length} 张素材`
                  : "仅恢复参数"}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/studio?module=${job.module}&restore=${job.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#17120d] px-4 py-2 text-sm font-medium text-[#f8f4e7]"
            >
              恢复并继续编辑
            </Link>
            <button
              type="button"
              onClick={downloadResults}
              className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
            >
              <Download className="h-4 w-4" />
              下载结果包
            </button>
            {job.textResults?.length ? (
              <>
                <button
                  type="button"
                  onClick={copyBundleToClipboard}
                  className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                >
                  <Copy className="h-4 w-4" />
                  复制文案包
                </button>
                <button
                  type="button"
                  onClick={() => downloadCopyBundle("txt")}
                  className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                >
                  <FileText className="h-4 w-4" />
                  TXT
                </button>
                <button
                  type="button"
                  onClick={() => downloadCopyBundle("json")}
                  className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f7efe0]"
                >
                  <FileJson2 className="h-4 w-4" />
                  JSON
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <ImageLightbox
        images={lightboxImages}
        openIndex={openIndex}
        onOpenIndexChange={setOpenIndex}
      />
    </article>
  );
}

export function HistoryScreen() {
  const jobs = useLiveQuery(
    () => nnbDb.jobs.orderBy("createdAt").reverse().toArray(),
    [],
  );
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<StudioModule | "all">("all");

  const filteredJobs = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return (jobs ?? []).filter((job) => {
      const matchesModule = moduleFilter === "all" || job.module === moduleFilter;
      const haystack = [
        job.title,
        job.prompt,
        job.workflowMode ?? "",
        job.extraNotes ?? "",
        job.productFacts ?? "",
        job.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return matchesModule && (!keyword || haystack.includes(keyword));
    });
  }, [jobs, moduleFilter, query]);

  return (
    <div className="space-y-6">
      <section className="studio-card rounded-[32px] p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.34em] text-[#9a8759]">History</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#17120d]">
          本地生成历史
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6f604c]">
          当前版本优先把结果图片保存在浏览器本地。你可以恢复同一设备上的本地素材继续生成，也可以把结果包和文案包重新导出。
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b7b63]" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、提示词、工作模式或备注"
              className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm outline-none focus:border-[#caa64c]"
            />
          </label>

          <select
            value={moduleFilter}
            onChange={(event) =>
              setModuleFilter(event.target.value as StudioModule | "all")
            }
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-[#caa64c]"
          >
            <option value="all">全部模块</option>
            {STUDIO_NAV_ITEMS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {filteredJobs.length ? (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <HistoryCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <section className="studio-card rounded-[32px] p-10 text-center">
          <RefreshCcw className="mx-auto h-10 w-10 text-[#caa64c]" />
          <h2 className="mt-4 text-xl font-semibold text-[#17120d]">
            暂时还没有符合条件的历史
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#6f604c]">
            去主图、服装、带货或精修工作台生成一次内容，系统就会把结果保存在当前浏览器里。
          </p>
        </section>
      )}
    </div>
  );
}
