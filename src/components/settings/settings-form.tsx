"use client";

import {
  CheckCircle2,
  Cloud,
  KeyRound,
  LogOut,
  Mail,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useSupabaseAuth } from "@/components/providers/auth-provider";
import {
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_HQ_IMAGE_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TEXT_MODEL,
  IMAGE_MODEL_OPTIONS,
  getDefaultHqImageModel,
  getDefaultImageModel,
} from "@/config/studio";
import { useSettingsStore } from "@/stores/settings-store";
import { ASPECT_RATIOS, IMAGE_SIZES } from "@/types/studio";

export function SettingsForm({ authStatus }: { authStatus?: string }) {
  const settings = useSettingsStore();
  const { client, isConfigured, isLoading, user } = useSupabaseAuth();
  const updateSettings = settings.updateSettings;

  const [isTesting, setIsTesting] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [email, setEmail] = useState("");

  const speedImageModelOptions = useMemo(
    () => [
      ...IMAGE_MODEL_OPTIONS.filter(
        (option) =>
          option.value === DEFAULT_IMAGE_MODEL ||
          option.value === "gemini-3.1-flash-image",
      ),
    ],
    [],
  );

  const hqImageModelOptions = useMemo(
    () => [
      ...IMAGE_MODEL_OPTIONS.filter(
        (option) =>
          option.value === DEFAULT_HQ_IMAGE_MODEL ||
          option.value === "gemini-3.0-pro-image",
      ),
    ],
    [],
  );

  useEffect(() => {
    if (authStatus === "success") {
      toast.success("Login callback completed.");
    }
  }, [authStatus]);

  useEffect(() => {
    const nextSettings: Record<string, string> = {};
    const speedValues = new Set<string>(
      speedImageModelOptions.map((option) => option.value),
    );
    const hqValues = new Set<string>(
      hqImageModelOptions.map((option) => option.value),
    );

    if (!speedValues.has(settings.defaultImageModel)) {
      nextSettings.defaultImageModel = getDefaultImageModel();
    }

    if (!hqValues.has(settings.hqImageModel)) {
      nextSettings.hqImageModel = getDefaultHqImageModel();
    }

    if (Object.keys(nextSettings).length > 0) {
      updateSettings(nextSettings);
    }
  }, [
    hqImageModelOptions,
    settings.defaultImageModel,
    settings.hqImageModel,
    speedImageModelOptions,
    updateSettings,
  ]);

  async function handleTestConnection() {
    if (!settings.apiBaseUrl.trim()) {
      toast.error("Please fill in the API URL first.");
      return;
    }

    if (!settings.apiKey.trim()) {
      toast.error("Please fill in the API key first.");
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch("/api/gemini/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseUrl: settings.apiBaseUrl,
          apiKey: settings.apiKey,
          model: settings.defaultTextModel,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Connection test failed.");
      }

      toast.success("Gemini connection looks good.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection test failed.");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleMagicLinkSignIn() {
    if (!client) {
      toast.error("Supabase is not configured.");
      return;
    }

    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }

    setIsAuthBusy(true);

    try {
      const redirectBase = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${redirectBase}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      toast.success("Magic link sent. Check your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send login link.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (!client) {
      return;
    }

    setIsAuthBusy(true);

    try {
      const { error } = await client.auth.signOut();
      if (error) {
        throw error;
      }

      toast.success("Signed out.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out failed.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleCloudSync() {
    if (!user) {
      toast.error("Please log in before syncing settings.");
      return;
    }

    setIsSyncBusy(true);

    try {
      const response = await fetch("/api/sync/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseUrl: settings.apiBaseUrl,
          defaultImageModel: settings.defaultImageModel,
          hqImageModel: settings.hqImageModel,
          defaultTextModel: settings.defaultTextModel,
          defaultAspectRatio: settings.defaultAspectRatio,
          defaultImageSize: settings.defaultImageSize,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Cloud sync failed.");
      }

      toast.success("Default settings synced to Supabase.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cloud sync failed.");
    } finally {
      setIsSyncBusy(false);
    }
  }

  async function handlePullCloudSettings() {
    if (!user) {
      toast.error("Please log in before pulling cloud settings.");
      return;
    }

    setIsSyncBusy(true);

    try {
      const response = await fetch("/api/sync/settings");
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        settings?: {
          base_url?: string;
          default_image_model?: string;
          hq_image_model?: string;
          default_text_model?: string;
          default_aspect_ratio?: string;
          default_image_size?: string;
        } | null;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to pull cloud settings.");
      }

      if (!payload.settings) {
        toast.message("No cloud defaults found yet.");
        return;
      }

      updateSettings({
        apiBaseUrl: payload.settings.base_url ?? settings.apiBaseUrl,
        defaultImageModel:
          payload.settings.default_image_model ?? settings.defaultImageModel,
        hqImageModel: payload.settings.hq_image_model ?? settings.hqImageModel,
        defaultTextModel:
          payload.settings.default_text_model ?? settings.defaultTextModel,
        defaultAspectRatio:
          (payload.settings.default_aspect_ratio as (typeof ASPECT_RATIOS)[number]) ??
          settings.defaultAspectRatio,
        defaultImageSize:
          (payload.settings.default_image_size as (typeof IMAGE_SIZES)[number]) ??
          settings.defaultImageSize,
      });

      toast.success("Cloud defaults loaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to pull cloud settings.");
    } finally {
      setIsSyncBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,720px)_minmax(260px,1fr)]">
      <section className="studio-card rounded-[32px] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-[#9a8759]">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#17120d]">
              API And Default Workspace Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6f604c]">
              This version only keeps the mccum Gemini path. Configure the API URL,
              API key, default image models, text model, aspect ratio, and image size here.
            </p>
          </div>
          <div className="rounded-full bg-[#f3ebdb] px-4 py-2 text-xs font-medium text-[#8d7740]">
            BYOK
          </div>
        </div>

        <div className="mt-8 grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-[#2e271d]">API URL</span>
            <input
              type="url"
              value={settings.apiBaseUrl}
              onChange={(event) =>
                updateSettings({ apiBaseUrl: event.target.value.trim() })
              }
              placeholder={DEFAULT_GEMINI_BASE_URL}
              className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-[#2e271d]">API Key</span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(event) =>
                updateSettings({ apiKey: event.target.value.trim() })
              }
              placeholder="AIza..."
              className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
            />
          </label>

          <label className="inline-flex items-center gap-3 rounded-[22px] border border-black/8 bg-[#faf7f1] px-4 py-4 text-sm text-[#544736]">
            <input
              type="checkbox"
              checked={settings.rememberApiKey}
              onChange={(event) =>
                updateSettings({ rememberApiKey: event.target.checked })
              }
              className="h-4 w-4 rounded border-black/20"
            />
            Remember API key in this browser
          </label>

          <label className="inline-flex items-center gap-3 rounded-[22px] border border-black/8 bg-[#faf7f1] px-4 py-4 text-sm text-[#544736]">
            <input
              type="checkbox"
              checked={settings.syncToCloud}
              onChange={(event) =>
                updateSettings({ syncToCloud: event.target.checked })
              }
              className="h-4 w-4 rounded border-black/20"
            />
            Sync defaults and job metadata to Supabase after login
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#2e271d]">Default image model</span>
              <select
                value={settings.defaultImageModel}
                onChange={(event) =>
                  updateSettings({ defaultImageModel: event.target.value })
                }
                className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
              >
                {speedImageModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#2e271d]">High quality image model</span>
              <select
                value={settings.hqImageModel}
                onChange={(event) =>
                  updateSettings({ hqImageModel: event.target.value })
                }
                className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
              >
                {hqImageModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#2e271d]">Default text model</span>
              <select
                value={settings.defaultTextModel}
                onChange={(event) =>
                  updateSettings({ defaultTextModel: event.target.value })
                }
                className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
              >
                <option value={DEFAULT_TEXT_MODEL}>{DEFAULT_TEXT_MODEL}</option>
                <option value="gemini-3.1-flash-lite-preview">
                  gemini-3.1-flash-lite-preview
                </option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#2e271d]">Default aspect ratio</span>
              <select
                value={settings.defaultAspectRatio}
                onChange={(event) =>
                  updateSettings({
                    defaultAspectRatio:
                      event.target.value as (typeof ASPECT_RATIOS)[number],
                  })
                }
                className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
              >
                {ASPECT_RATIOS.map((aspectRatio) => (
                  <option key={aspectRatio} value={aspectRatio}>
                    {aspectRatio}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#2e271d]">Default image size</span>
              <select
                value={settings.defaultImageSize}
                onChange={(event) =>
                  updateSettings({
                    defaultImageSize: event.target.value as (typeof IMAGE_SIZES)[number],
                  })
                }
                className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
              >
                {IMAGE_SIZES.map((imageSize) => (
                  <option key={imageSize} value={imageSize}>
                    {imageSize}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="inline-flex items-center gap-2 rounded-full bg-[#17120d] px-5 py-3 text-sm font-medium text-[#f9f5ea] transition-opacity hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isTesting ? "Testing..." : "Test current API connection"}
          </button>
          <button
            type="button"
            onClick={handleCloudSync}
            disabled={!isConfigured || !user || isSyncBusy}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-[#3a3024] transition-colors hover:bg-[#f7efe0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Cloud className="h-4 w-4" />
            {isSyncBusy ? "Syncing..." : "Sync defaults to cloud"}
          </button>
          <button
            type="button"
            onClick={handlePullCloudSettings}
            disabled={!isConfigured || !user || isSyncBusy}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-[#3a3024] transition-colors hover:bg-[#f7efe0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            Pull cloud defaults
          </button>
          <button
            type="button"
            onClick={() =>
              updateSettings({
                apiBaseUrl: DEFAULT_GEMINI_BASE_URL,
                defaultImageModel: getDefaultImageModel(),
                hqImageModel: getDefaultHqImageModel(),
                defaultTextModel: DEFAULT_TEXT_MODEL,
                defaultAspectRatio: "3:4",
                defaultImageSize: "1K",
              })
            }
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-[#3a3024] transition-colors hover:bg-[#f7efe0]"
          >
            <Sparkles className="h-4 w-4" />
            Restore recommended defaults
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="studio-card rounded-[28px] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#17120d] text-[#f7e7b2]">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-[#17120d]">Account and cloud sync</p>
              <p className="text-sm text-[#6f604c]">
                {isConfigured ? "Optional login, metadata only sync" : "Supabase not configured"}
              </p>
            </div>
          </div>

          {isConfigured ? (
            user ? (
              <div className="mt-4 space-y-3 text-sm text-[#5c4e3b]">
                <div className="rounded-[20px] border border-black/8 bg-white px-4 py-4">
                  <p className="font-medium text-[#17120d]">{user.email || "Signed in"}</p>
                  <p className="mt-2 leading-6 text-[#6f604c]">
                    Default settings and job metadata can sync to Supabase. API keys stay in the local browser only.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isAuthBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#3a3024] hover:bg-[#f7efe0] disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter email to receive a magic link"
                  className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
                />
                <button
                  type="button"
                  onClick={handleMagicLinkSignIn}
                  disabled={isAuthBusy || isLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-[#17120d] px-4 py-3 text-sm font-medium text-[#f9f5ea] disabled:opacity-60"
                >
                  <Mail className="h-4 w-4" />
                  {isAuthBusy ? "Sending..." : "Send magic link"}
                </button>
              </div>
            )
          ) : (
            <p className="mt-4 text-sm leading-7 text-[#6f604c]">
              Add Supabase URL and publishable key in your environment later if you want login and cloud metadata sync.
            </p>
          )}
        </section>

        <section className="studio-card rounded-[28px] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#17120d] text-[#f7e7b2]">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-[#17120d]">Current strategy</p>
              <p className="text-sm text-[#6f604c]">mccum Gemini only</p>
            </div>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[#5c4e3b]">
            <li>Only the mccum Gemini path is kept</li>
            <li>Guests can paste their own key and use it directly</li>
            <li>Generated images stay in local browser storage first</li>
          </ul>
        </section>

        <section className="studio-card rounded-[28px] p-5">
          <p className="font-semibold text-[#17120d]">Download reminder</p>
          <p className="mt-3 text-sm leading-7 text-[#6f604c]">
            Images are not stored in the cloud long term right now. Download originals or bundles after each run so browser cache cleanup does not wipe them out.
          </p>
        </section>
      </aside>
    </div>
  );
}
