import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(profile?.role === "admin" ? "/admin" : "/dashboard");
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">Loading...</p>
    </div>
  );
}
