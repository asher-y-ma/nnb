"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_HQ_IMAGE_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TEXT_MODEL,
} from "@/config/studio";
import type { StudioSettings } from "@/types/studio";

type SettingsStore = StudioSettings & {
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  updateSettings: (settings: Partial<StudioSettings>) => void;
  clearApiKey: () => void;
};

const defaultSettings: StudioSettings = {
  apiBaseUrl: DEFAULT_GEMINI_BASE_URL,
  apiKey: "",
  defaultImageModel: DEFAULT_IMAGE_MODEL,
  hqImageModel: DEFAULT_HQ_IMAGE_MODEL,
  defaultTextModel: DEFAULT_TEXT_MODEL,
  defaultAspectRatio: "3:4",
  defaultImageSize: "1K",
  rememberApiKey: true,
  syncToCloud: false,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
      clearApiKey: () => set({ apiKey: "" }),
    }),
    {
      name: "nnb-settings",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
