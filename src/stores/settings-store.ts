"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_HQ_IMAGE_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TEXT_MODEL,
  normalizeStudioImageModel,
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
      updateSettings: (settings) =>
        set((state) => {
          const normalizedSettings = { ...settings };

          if (normalizedSettings.defaultImageModel) {
            normalizedSettings.defaultImageModel = normalizeStudioImageModel(
              normalizedSettings.defaultImageModel,
            );
          }

          if (normalizedSettings.hqImageModel) {
            normalizedSettings.hqImageModel = normalizeStudioImageModel(
              normalizedSettings.hqImageModel,
            );
          }

          const hasChanges = Object.entries(settings).some(
            ([key]) =>
              state[key as keyof typeof state] !==
              normalizedSettings[key as keyof typeof normalizedSettings],
          );

          if (!hasChanges) {
            return state;
          }

          return { ...state, ...normalizedSettings };
        }),
      clearApiKey: () => set({ apiKey: "" }),
    }),
    {
      name: "nnb-settings",
      version: 3,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<StudioSettings> & {
          hasHydrated?: boolean;
        };

        return {
          ...defaultSettings,
          ...state,
          apiBaseUrl:
            !state.apiBaseUrl || state.apiBaseUrl === DEFAULT_GEMINI_BASE_URL
              ? defaultSettings.apiBaseUrl
              : state.apiBaseUrl,
          defaultImageModel: normalizeStudioImageModel(
            state.defaultImageModel ?? defaultSettings.defaultImageModel,
          ),
          hqImageModel: normalizeStudioImageModel(
            state.hqImageModel ?? defaultSettings.hqImageModel,
          ),
          defaultTextModel: state.defaultTextModel ?? defaultSettings.defaultTextModel,
          defaultAspectRatio:
            state.defaultAspectRatio ?? defaultSettings.defaultAspectRatio,
          defaultImageSize: state.defaultImageSize ?? defaultSettings.defaultImageSize,
          rememberApiKey: state.rememberApiKey ?? defaultSettings.rememberApiKey,
          syncToCloud: state.syncToCloud ?? defaultSettings.syncToCloud,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
