"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

interface LightboxImage {
  src: string;
  alt: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  openIndex: number | null;
  onOpenIndexChange: (value: number | null) => void;
}

export function ImageLightbox({
  images,
  openIndex,
  onOpenIndexChange,
}: ImageLightboxProps) {
  const open = openIndex !== null;
  const currentIndex = openIndex ?? 0;

  if (!images.length) {
    return null;
  }

  const current = images[currentIndex];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => onOpenIndexChange(nextOpen ? currentIndex : null)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(13,10,6,0.76)] backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-4 z-50 rounded-[28px] border border-white/10 bg-[rgba(24,18,11,0.92)] p-4 shadow-2xl outline-none sm:inset-8 sm:p-6">
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#d6c08b]">
                  Preview
                </p>
                <p className="mt-1 text-sm text-white/72">
                  点击下载，避免浏览器缓存被清理。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={current.src}
                  download={`nnb-preview-${currentIndex + 1}.png`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/16"
                >
                  <Download className="h-4 w-4" />
                  下载
                </a>
                <Dialog.Close className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 hover:bg-white/16">
                  <X className="h-4 w-4" />
                </Dialog.Close>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.03)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.src}
                alt={current.alt}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-white/80">
              <button
                type="button"
                onClick={() =>
                  onOpenIndexChange((currentIndex - 1 + images.length) % images.length)
                }
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/16"
              >
                <ChevronLeft className="h-4 w-4" />
                上一张
              </button>
              <p className="text-sm">
                {currentIndex + 1} / {images.length}
              </p>
              <button
                type="button"
                onClick={() => onOpenIndexChange((currentIndex + 1) % images.length)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/16"
              >
                下一张
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
