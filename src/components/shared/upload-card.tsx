"use client";

import { Upload, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";

import { cn } from "@/lib/utils/cn";

interface UploadCardProps {
  title: string;
  hint: string;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadCard({
  title,
  hint,
  files,
  onChange,
  multiple = true,
  maxFiles = 8,
}: UploadCardProps) {
  const previews = useMemo(
    () =>
      files.map((file) => ({
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
    },
    multiple,
    maxFiles,
    onDrop: (acceptedFiles) => {
      if (multiple) {
        onChange([...files, ...acceptedFiles].slice(0, maxFiles));
        return;
      }

      onChange(acceptedFiles.slice(0, 1));
    },
  });

  return (
    <section className="studio-card rounded-[28px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#17120d]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[#7b6b56]">{hint}</p>
        </div>
        <div className="rounded-full bg-[#f3ebdb] px-3 py-1 text-[11px] font-medium text-[#8d7740]">
          {files.length}/{maxFiles}
        </div>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-[24px] border border-dashed px-4 py-6 text-center transition-colors",
          isDragActive
            ? "border-[#caa64c] bg-[#fbf3db]"
            : "border-black/10 bg-[#faf7f1] hover:bg-[#f7f0e4]",
        )}
      >
        <input {...getInputProps()} />
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#8d7740] shadow-[0_12px_30px_rgba(31,27,16,0.08)]">
          <Upload className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-medium text-[#2f271d]">
          点击或拖拽上传图片
        </p>
        <p className="mt-2 text-xs text-[#7b6b56]">
          支持 jpg、jpeg、png、webp、heic、heif
        </p>
      </div>

      {previews.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((preview, index) => (
            <div
              key={`${preview.name}-${index}`}
              className="overflow-hidden rounded-[20px] border border-black/8 bg-white"
            >
              <div className="aspect-square overflow-hidden bg-[#f5efe3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate text-xs font-medium text-[#2f271d]">
                  {preview.name}
                </p>
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#7b6b56]">
                  <span>{formatSize(preview.size)}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(files.filter((_, fileIndex) => fileIndex !== index));
                    }}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/8 bg-[#faf7f1] text-[#6c5c46] hover:bg-[#f1e6d2]"
                    aria-label={`移除 ${preview.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
