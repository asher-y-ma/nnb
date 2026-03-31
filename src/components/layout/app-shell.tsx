import { Suspense } from "react";

import { TopNav } from "@/components/layout/top-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,242,211,0.9),_rgba(245,241,233,0.95)_38%,_#f7f3ea_100%)] text-[#17120d]">
      <Suspense fallback={<div className="h-[81px]" />}>
        <TopNav />
      </Suspense>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
