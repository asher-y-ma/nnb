"use client";

import {
  Check,
  Copy,
  Download,
  Film,
} from "lucide-react";

import { downloadDataUrl } from "@/lib/studio/exporters";
import { cn } from "@/lib/utils/cn";
import type { CommerceCopyResult, StudioModule } from "@/types/studio";
import { MODULE_INSPIRATION_CARDS } from "@/lib/studio/workflow-presets";

interface SelectableCardProps {
  selected: boolean;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}

export function SelectableCard({
  selected,
  title,
  description,
  badge,
  onClick,
}: SelectableCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[22px] border px-4 py-4 text-left transition-colors",
        selected
          ? "border-[#caa64c] bg-[#fdf5df] shadow-[0_16px_40px_rgba(202,166,76,0.12)]"
          : "border-black/8 bg-white hover:bg-[#faf2e2]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#17120d]">{title}</p>
          <p className="mt-2 text-xs leading-6 text-[#6f604c]">{description}</p>
        </div>
        {selected ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#17120d] text-[#f9f5ea]">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : badge ? (
          <span className="rounded-full bg-[#f3ebdb] px-3 py-1 text-[11px] font-medium text-[#8d7740]">
            {badge}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function InspirationBoard({ module }: { module: StudioModule }) {
  const cards = MODULE_INSPIRATION_CARDS[module];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <article
          key={`${module}-${card.title}`}
          className="overflow-hidden rounded-[26px] border border-black/8 bg-white"
        >
          <div className="h-32 bg-[radial-gradient(circle_at_top_left,_rgba(248,224,172,0.9),_transparent_48%),radial-gradient(circle_at_bottom_right,_rgba(213,183,115,0.34),_transparent_45%),linear-gradient(140deg,#221d15_0%,#4d3f26_42%,#ead6a4_100%)]" />
          <div className="space-y-2 p-4">
            {card.eyebrow ? (
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#9a8759]">
                {card.eyebrow}
              </p>
            ) : null}
            <h3 className="text-base font-semibold text-[#17120d]">{card.title}</h3>
            <p className="text-sm leading-6 text-[#6f604c]">{card.subtitle}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ResultImageGrid({
  images,
  title,
  onPreview,
}: {
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
    description?: string;
  }>;
  title: string;
  onPreview: (index: number) => void;
}) {
  if (!images.length) {
    return null;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {images.map((image, index) => (
        <article
          key={`${image.alt}-${index}`}
          className="overflow-hidden rounded-[28px] border border-black/8 bg-white"
        >
          <button type="button" onClick={() => onPreview(index)} className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt={image.alt} className="aspect-[4/5] w-full object-cover" />
          </button>
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#17120d]">
                  {image.caption || title}
                </p>
                <p className="mt-1 text-xs text-[#7b6b56]">点击图片查看大图</p>
              </div>
              <button
                type="button"
                onClick={() => downloadDataUrl(image.src, `${title}-${index + 1}.png`)}
                className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#faf7f1] px-4 py-2 text-sm font-medium text-[#3b3226] hover:bg-[#f4ebd9]"
              >
                <Download className="h-4 w-4" />
                下载
              </button>
            </div>
            {image.description ? (
              <p className="text-sm leading-6 text-[#5a4c39]">{image.description}</p>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function CopyResultsSection({
  copyResults,
  onCopy,
}: {
  copyResults: CommerceCopyResult[];
  onCopy: (copyItem: CommerceCopyResult) => void;
}) {
  if (!copyResults.length) {
    return null;
  }

  return (
    <section className="mt-6 grid gap-4 xl:grid-cols-2">
      {copyResults.map((copyItem) => (
        <article
          key={copyItem.id}
          className="rounded-[26px] border border-black/8 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#f3ebdb] px-3 py-1 text-[11px] font-medium text-[#8d7740]">
                {copyItem.platform}
              </span>
              {copyItem.coverText ? (
                <span className="rounded-full border border-[#ead8a7] bg-[#fdf5df] px-3 py-1 text-[11px] text-[#7b6328]">
                  封面文案已生成
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onCopy(copyItem)}
              className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-medium text-[#5c4e3b] hover:bg-[#faf1df]"
            >
              <Copy className="h-3.5 w-3.5" />
              复制本条
            </button>
          </div>

          <h3 className="mt-4 text-lg font-semibold text-[#17120d]">{copyItem.title}</h3>

          {copyItem.coverText ? (
            <div className="mt-3 rounded-[18px] border border-[#ead8a7] bg-[#fdf5df] px-4 py-3 text-sm text-[#6f5820]">
              封面文案：{copyItem.coverText}
            </div>
          ) : null}

          {copyItem.openingLine ? (
            <div className="mt-3 rounded-[18px] border border-black/8 bg-[#faf7f1] px-4 py-3 text-sm text-[#5a4c39]">
              开场钩子：{copyItem.openingLine}
            </div>
          ) : null}

          <p className="mt-4 text-sm leading-7 text-[#5a4c39]">{copyItem.body}</p>

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

          {copyItem.storyboard?.length ? (
            <div className="mt-5">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-[#8d7740]" />
                <p className="text-sm font-semibold text-[#17120d]">视频分镜</p>
              </div>
              <div className="mt-3 grid gap-3">
                {copyItem.storyboard.map((frame, index) => (
                  <article
                    key={`${copyItem.id}-frame-${index}`}
                    className="rounded-[20px] border border-black/8 bg-[#fcfaf5] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#17120d]">
                        {index + 1}. {frame.title}
                      </p>
                      {frame.overlayText ? (
                        <span className="rounded-full bg-[#f3ebdb] px-3 py-1 text-[11px] text-[#7b6328]">
                          {frame.overlayText}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#5a4c39]">
                      镜头说明：{frame.direction}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#6f604c]">
                      视觉提示：{frame.visualPrompt}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : copyItem.shotList?.length ? (
            <div className="mt-5">
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

          <div className="mt-5 rounded-[20px] bg-[#17120d] px-4 py-3 text-sm font-medium text-[#f8f4e7]">
            CTA：{copyItem.cta}
          </div>
        </article>
      ))}
    </section>
  );
}
