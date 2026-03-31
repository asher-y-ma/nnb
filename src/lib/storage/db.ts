import Dexie, { type Table } from "dexie";

import type { LocalAssetRecord, LocalJobRecord, StudioSettings } from "@/types/studio";

export interface SettingsRecord {
  id: "app";
  value: StudioSettings;
}

export class NnbDatabase extends Dexie {
  assets!: Table<LocalAssetRecord, string>;
  jobs!: Table<LocalJobRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super("nnb-studio");

    this.version(1).stores({
      assets: "id, kind, createdAt",
      jobs: "id, module, status, createdAt, updatedAt",
      settings: "id",
    });
  }
}

export const nnbDb = new NnbDatabase();
