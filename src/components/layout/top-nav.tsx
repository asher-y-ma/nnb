"use client";

import { GalleryVerticalEnd, History, Settings2, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";

import { useSupabaseAuth } from "@/components/providers/auth-provider";
import { STUDIO_NAV_ITEMS } from "@/config/studio";
import { cn } from "@/lib/utils/cn";

export function TopNav() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeModule = pathname === "/studio" ? searchParams.get("module") ?? "main" : null;
  const { isConfigured, isLoading, user } = useSupabaseAuth();
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const authLabel = !isConfigured
    ? "未配置云同步"
    : !hasMounted
      ? "游客模式"
      : isLoading
        ? "认证检查中"
        : user
          ? user.email || "已登录"
          : "游客模式";

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-[rgba(249,246,239,0.88)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/studio?module=main"
            className="flex items-center gap-3 rounded-full border border-black/10 bg-white/85 px-4 py-2 shadow-[0_10px_25px_rgba(31,27,16,0.06)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17120d] text-[#f7e7b2]">
              <GalleryVerticalEnd className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#9f8f74]">NNB</p>
              <p className="font-semibold tracking-tight text-[#17120d]">
                Ecommerce AI Studio
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-black/8 bg-white/80 px-3 py-2 text-sm text-[#5a4d3a] lg:inline-flex">
              <UserRound className="h-4 w-4" />
              {authLabel}
            </div>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/80 px-4 py-2 text-sm font-medium text-[#3b3226] transition-colors hover:bg-[#f7efe0]"
            >
              <History className="h-4 w-4" />
              历史
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/80 px-4 py-2 text-sm font-medium text-[#3b3226] transition-colors hover:bg-[#f7efe0]"
            >
              <Settings2 className="h-4 w-4" />
              设置
            </Link>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto rounded-full border border-black/6 bg-white/75 p-1">
          {STUDIO_NAV_ITEMS.map((item) => {
            const href = `/studio?module=${item.id}`;

            return (
              <Link
                key={item.id}
                href={href}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  activeModule === item.id
                    ? "bg-[#17120d] text-[#f9f5ea]"
                    : "text-[#6b5d49] hover:bg-[#f3ede1]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
