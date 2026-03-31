import JSZip from "jszip";

import type { CommerceCopyResult, LocalAssetRecord } from "@/types/studio";

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

function getExtensionFromMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/svg+xml") {
    return "svg";
  }

  return mimeType.split("/")[1] || "bin";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeFilename(filename);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = sanitizeFilename(filename);
  anchor.click();
}

export async function downloadAssetBundle({
  title,
  assets,
}: {
  title: string;
  assets: LocalAssetRecord[];
}) {
  const zip = new JSZip();

  assets.forEach((asset, index) => {
    const extension = getExtensionFromMimeType(asset.mimeType);
    const fallbackName = `${sanitizeFilename(title)}-${index + 1}.${extension}`;
    const name = asset.name.includes(".")
      ? sanitizeFilename(asset.name)
      : `${sanitizeFilename(asset.name)}.${extension}`;

    zip.file(name || fallbackName, asset.blob);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${sanitizeFilename(title)}.zip`);
}

export function buildCopyTextBundle(title: string, copyResults: CommerceCopyResult[]) {
  return copyResults
    .map((copyItem, index) => {
      const sections = [
        `# ${title} - 文案 ${index + 1}`,
        `平台：${copyItem.platform}`,
        `标题：${copyItem.title}`,
      ];

      if (copyItem.openingLine) {
        sections.push(`开场钩子：${copyItem.openingLine}`);
      }

      if (copyItem.sellingPoints?.length) {
        sections.push(`卖点结构：${copyItem.sellingPoints.join(" / ")}`);
      }

      sections.push(`正文：\n${copyItem.body}`);

      if (copyItem.tags.length) {
        sections.push(`标签：${copyItem.tags.map((tag) => `#${tag}`).join(" ")}`);
      }

      if (copyItem.shotList?.length) {
        sections.push(
          `视频预备分镜：\n${copyItem.shotList
            .map((shot, shotIndex) => `${shotIndex + 1}. ${shot}`)
            .join("\n")}`,
        );
      }

      sections.push(`CTA：${copyItem.cta}`);

      return sections.join("\n\n");
    })
    .join("\n\n------------------------------\n\n");
}

export function buildCopyJsonBundle(title: string, copyResults: CommerceCopyResult[]) {
  return JSON.stringify(
    {
      title,
      generatedAt: new Date().toISOString(),
      items: copyResults,
    },
    null,
    2,
  );
}
