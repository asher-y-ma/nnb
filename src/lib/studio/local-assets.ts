import type { LocalAssetRecord } from "@/types/studio";

export type InputAssetRole = NonNullable<LocalAssetRecord["role"]>;

const INPUT_ASSET_ROLES: InputAssetRole[] = [
  "product",
  "reference",
  "source",
  "model",
  "inner",
];

export function createInputAssetRecords(
  files: File[],
  role: InputAssetRole,
  createdAt: string,
) {
  return files.map<LocalAssetRecord>((file, index) => ({
    id: crypto.randomUUID(),
    kind: "input",
    role,
    name: file.name || `${role}-${index + 1}.png`,
    mimeType: file.type || "image/png",
    size: file.size,
    blob: file,
    createdAt,
  }));
}

export function localAssetToFile(asset: LocalAssetRecord) {
  return new File([asset.blob], asset.name, {
    type: asset.mimeType,
    lastModified: Date.parse(asset.createdAt) || Date.now(),
  });
}

export function groupInputAssetFiles(assets: LocalAssetRecord[]) {
  const grouped = Object.fromEntries(
    INPUT_ASSET_ROLES.map((role) => [role, [] as File[]]),
  ) as Record<InputAssetRole, File[]>;

  assets.forEach((asset) => {
    if (asset.kind !== "input" || !asset.role) {
      return;
    }

    grouped[asset.role].push(localAssetToFile(asset));
  });

  return grouped;
}
