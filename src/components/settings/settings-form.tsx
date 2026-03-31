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
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useSupabaseAuth } from "@/components/providers/auth-provider";
import {
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_HQ_IMAGE_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TEXT_MODEL,
} from "@/config/studio";
import { useSettingsStore } from "@/stores/settings-store";
import { ASPECT_RATIOS, IMAGE_SIZES } from "@/types/studio";

export function SettingsForm({ authStatus }: { authStatus?: string }) {
  const settings = useSettingsStore();
  const { client, isConfigured, isLoading, user } = useSupabaseAuth();

  const [isTesting, setIsTesting] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (authStatus === "success") {
      toast.success("邮箱登录成功，已完成回调。");
    }
  }, [authStatus]);

  async function handleTestConnection() {
    if (!settings.apiBaseUrl.trim()) {
      toast.error("请先填写 Gemini API URL。");
      return;
    }

    if (!settings.apiKey.trim()) {
      toast.error("请先填写 Gemini API Key。");
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
        throw new Error(payload.error ?? "测试失败");
      }

      toast.success("Gemini 连通性正常，可以开始使用。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试失败");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleMagicLinkSignIn() {
    if (!client) {
      toast.error("当前环境未配置 Supabase。");
      return;
    }

    if (!email.trim()) {
      toast.error("请先填写邮箱地址。");
      return;
    }

    setIsAuthBusy(true);

    try {
      const redirectBase =
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${redirectBase}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      toast.success("登录链接已发送到邮箱，请点击邮件完成登录。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败");
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

      toast.success("已退出登录。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "退出失败");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleCloudSync() {
    if (!user) {
      toast.error("请先登录再同步云端设置。");
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
        throw new Error(payload.error ?? "同步失败");
      }

      toast.success("当前默认设置已同步到 Supabase。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同步失败");
    } finally {
      setIsSyncBusy(false);
    }
  }

  async function handlePullCloudSettings() {
    if (!user) {
      toast.error("请先登录再拉取云端设置。");
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
        throw new Error(payload.error ?? "拉取失败");
      }

      if (!payload.settings) {
        toast.message("云端还没有保存过默认设置。");
        return;
      }

      settings.updateSettings({
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

      toast.success("已拉取云端默认设置。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "拉取失败");
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
              Gemini 与默认工作参数
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6f604c]">
              当前版本只使用标准 Gemini 官方方式。你可以在这里设置 API Key、
              默认图像模型、默认文字模型、默认比例，以及是否启用云端元数据同步。
            </p>
          </div>
          <div className="rounded-full bg-[#f3ebdb] px-4 py-2 text-xs font-medium text-[#8d7740]">
            BYOK
          </div>
        </div>

        <div className="mt-8 grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-[#2e271d]">Gemini API URL</span>
            <input
              type="url"
              value={settings.apiBaseUrl}
              onChange={(event) =>
                settings.updateSettings({ apiBaseUrl: event.target.value.trim() })
              }
              placeholder="https://mccum.com/"
              className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-[#2e271d]">Gemini API Key</span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(event) =>
                settings.updateSettings({ apiKey: event.target.value.trim() })
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
                settings.updateSettings({ rememberApiKey: event.target.checked })
              }
              className="h-4 w-4 rounded border-black/20"
            />
            在当前浏览器中记住 API Key，方便游客直接继续使用
          </label>

          <label className="inline-flex items-center gap-3 rounded-[22px] border border-black/8 bg-[#faf7f1] px-4 py-4 text-sm text-[#544736]">
            <input
              type="checkbox"
              checked={settings.syncToCloud}
              onChange={(event) =>
                settings.updateSettings({ syncToCloud: event.target.checked })
              }
              className="h-4 w-4 rounded border-black/20"
            />
            登录后同步默认设置和任务元数据到 Supabase
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#2e271d]">默认图像模型</span>
              <select
                value={settings.defaultImageModel}
                onChange={(event) =>
                  settings.updateSettings({ defaultImageModel: event.target.value })
                }
                className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
              >
                <option value={DEFAULT_IMAGE_MODEL}>{DEFAULT_IMAGE_MODEL}</option>
                <option value="gemini-2.5-flash-image">gemini-2.5-flash-image</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#2e271d]">高质量图像模型</span>
              <select
                value={settings.hqImageModel}
                onChange={(event) =>
                  settings.updateSettings({ hqImageModel: event.target.value })
                }
                className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
              >
                <option value={DEFAULT_HQ_IMAGE_MODEL}>{DEFAULT_HQ_IMAGE_MODEL}</option>
                <option value={DEFAULT_IMAGE_MODEL}>{DEFAULT_IMAGE_MODEL}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#2e271d]">默认文字模型</span>
              <select
                value={settings.defaultTextModel}
                onChange={(event) =>
                  settings.updateSettings({ defaultTextModel: event.target.value })
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
              <span className="text-sm font-medium text-[#2e271d]">默认比例</span>
              <select
                value={settings.defaultAspectRatio}
                onChange={(event) =>
                  settings.updateSettings({
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
              <span className="text-sm font-medium text-[#2e271d]">默认尺寸</span>
              <select
                value={settings.defaultImageSize}
                onChange={(event) =>
                  settings.updateSettings({
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
            {isTesting ? "测试中..." : "测试 Gemini 连通性"}
          </button>
          <button
            type="button"
            onClick={handleCloudSync}
            disabled={!isConfigured || !user || isSyncBusy}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-[#3a3024] transition-colors hover:bg-[#f7efe0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Cloud className="h-4 w-4" />
            {isSyncBusy ? "同步中..." : "同步当前设置到云端"}
          </button>
          <button
            type="button"
            onClick={handlePullCloudSettings}
            disabled={!isConfigured || !user || isSyncBusy}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-[#3a3024] transition-colors hover:bg-[#f7efe0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            拉取云端默认设置
          </button>
          <button
            type="button"
            onClick={() =>
              settings.updateSettings({
                apiBaseUrl: DEFAULT_GEMINI_BASE_URL,
                defaultImageModel: DEFAULT_IMAGE_MODEL,
                hqImageModel: DEFAULT_HQ_IMAGE_MODEL,
                defaultTextModel: DEFAULT_TEXT_MODEL,
                defaultAspectRatio: "3:4",
                defaultImageSize: "1K",
              })
            }
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-[#3a3024] transition-colors hover:bg-[#f7efe0]"
          >
            <Sparkles className="h-4 w-4" />
            恢复推荐默认值
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
              <p className="font-semibold text-[#17120d]">账号与云端同步</p>
              <p className="text-sm text-[#6f604c]">
                {isConfigured ? "可选登录，云端只同步元数据" : "当前未配置 Supabase"}
              </p>
            </div>
          </div>

          {isConfigured ? (
            user ? (
              <div className="mt-4 space-y-3 text-sm text-[#5c4e3b]">
                <div className="rounded-[20px] border border-black/8 bg-white px-4 py-4">
                  <p className="font-medium text-[#17120d]">
                    {user.email || "已登录"}
                  </p>
                  <p className="mt-2 leading-6 text-[#6f604c]">
                    默认设置和任务元数据可同步到 Supabase。API Key 仍默认只保存在本地浏览器，不上传云端。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isAuthBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#3a3024] hover:bg-[#f7efe0] disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="输入邮箱，接收登录链接"
                  className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors focus:border-[#caa64c]"
                />
                <button
                  type="button"
                  onClick={handleMagicLinkSignIn}
                  disabled={isAuthBusy || isLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-[#17120d] px-4 py-3 text-sm font-medium text-[#f9f5ea] disabled:opacity-60"
                >
                  <Mail className="h-4 w-4" />
                  {isAuthBusy ? "发送中..." : "发送邮箱登录链接"}
                </button>
              </div>
            )
          ) : (
            <p className="mt-4 text-sm leading-7 text-[#6f604c]">
              你可以稍后在 `.env` 中补上 Supabase URL 与 Publishable Key，登录能力和云端元数据同步就会自动启用。
            </p>
          )}
        </section>

        <section className="studio-card rounded-[28px] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#17120d] text-[#f7e7b2]">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-[#17120d]">当前策略</p>
              <p className="text-sm text-[#6f604c]">官方 Gemini 直连</p>
            </div>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[#5c4e3b]">
            <li>不使用 OpenAI 兼容层</li>
            <li>不接 Imagen 4</li>
            <li>游客可直接输入 Key 使用</li>
            <li>图片结果优先保存在浏览器本地</li>
          </ul>
        </section>

        <section className="studio-card rounded-[28px] p-5">
          <p className="font-semibold text-[#17120d]">下载提醒</p>
          <p className="mt-3 text-sm leading-7 text-[#6f604c]">
            当前版本不长期保存在云端。每次生成完成后，请尽快下载原图或批量打包下载，避免浏览器缓存被系统回收。
          </p>
        </section>
      </aside>
    </div>
  );
}
