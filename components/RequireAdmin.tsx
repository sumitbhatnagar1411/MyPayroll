"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth-context";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, profile, loading, router]);

  if (loading || !user || profile?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
