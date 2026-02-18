"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { useAuth } from "./Providers";

export function LayoutGuard({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const isAuthPage = path === "/login" || path === "/register";

  useEffect(() => {
    if (loading) return;
    if (isAuthPage && user) {
      router.replace("/");
      return;
    }
    if (!isAuthPage && !user) {
      router.replace("/login");
    }
  }, [loading, user, isAuthPage, router]);

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-10 h-10 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
