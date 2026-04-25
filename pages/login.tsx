import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { createBrowserClient } from "@/lib/supabase-client";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const ensureProfile = async (accessToken: string) => {
    await fetch("/api/auth/ensure-profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      if (isForgotPassword) {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?reset=true`,
        });
        if (authError) {
          setError(authError.message);
          return;
        }
        setSuccess("Check your email for the password reset link.");
        return;
      }
      if (isSignUp) {
        const { data: signUpData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) {
          setError(authError.message);
          return;
        }
        if (signUpData.session && signUpData.user) {
          await ensureProfile(signUpData.session.access_token);
          const { data: profile } = await supabase.from("profiles").select("role").eq("id", signUpData.user.id).single();
          const role = (profile as { role?: string })?.role || "employee";
          router.push(role === "admin" ? "/admin" : "/dashboard");
          return;
        }
        setSuccess("Account created! Check your email to confirm, then sign in.");
        return;
      }
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        return;
      }
      await ensureProfile(data.session.access_token);
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      const role = (profile as { role?: string })?.role || "employee";
      router.push(role === "admin" ? "/admin" : "/dashboard");
    } catch {
      setError(isForgotPassword ? "Failed to send reset email" : isSignUp ? "Sign up failed" : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-8">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <Image src="/logo.png" alt="Neurons Technologies LLC" width={64} height={64} className="mb-3 sm:mb-4" />
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 text-center">Neurons Technologies</h1>
          <p className="text-xs sm:text-sm text-slate-500 text-center">Payroll System</p>
        </div>
        <p className="text-slate-600 text-xs sm:text-sm text-center mb-6 sm:mb-8">
          {isForgotPassword ? "Reset your password" : isSignUp ? "Create your account" : "Sign in to your account"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm sm:text-base border border-slate-300 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          {!isForgotPassword && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm sm:text-base border border-slate-300 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required={!isForgotPassword}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(true); setError(""); setSuccess(""); }}
                  className="mt-1.5 text-xs sm:text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}
          {error && <p className="text-red-600 text-xs sm:text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
          {success && <p className="text-emerald-600 text-xs sm:text-sm bg-emerald-50 p-3 rounded-lg">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm sm:text-base disabled:opacity-50 transition-colors"
          >
            {loading
              ? (isForgotPassword ? "Sending..." : isSignUp ? "Creating account..." : "Signing in...")
              : isForgotPassword
                ? "Send reset link"
                : isSignUp
                  ? "Sign up"
                  : "Sign in"}
          </button>
        </form>

        <p className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-slate-600">
          {isForgotPassword ? (
            <>
              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setError(""); setSuccess(""); }}
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(""); setSuccess(""); }}
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
