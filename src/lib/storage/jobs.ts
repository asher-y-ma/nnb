import { nnbDb } from "@/lib/storage/db";
import type { LocalAssetRecord, LocalJobRecord } from "@/types/studio";

export async function saveAssets(assets: LocalAssetRecord[]) {
  await nnbDb.assets.bulkPut(assets);
}

export const saveOutputAssets = saveAssets;

export async function saveJob(job: LocalJobRecord) {
  await nnbDb.jobs.put(job);
}

export async function listJobs() {
  return nnbDb.jobs.orderBy("createdAt").reverse().toArray();
}

export async function getAssetsByIds(ids: string[]) {
  return nnbDb.assets.bulkGet(ids);
}
