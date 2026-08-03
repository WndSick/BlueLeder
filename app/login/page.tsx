"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccess("Account created successfully. Please sign in.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-emerald-950 to-slate-950 p-6">
      <div className="relative w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-emerald-900/30 rounded-2xl p-8 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-teal-500/5 rounded-2xl pointer-events-none" />

        <div className="relative text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4 text-emerald-400 font-bold text-xl tracking-wider">
            BC
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Welcome to BlueRegistry</h1>
          <p className="text-sm text-slate-400 mt-2">Sign in to access your workspace</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm rounded-lg">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500/50 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              placeholder="e.g. demo@blueregistry.local"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500/50 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-emerald-500/25 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-800/60 pt-6">
          <p className="text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
              Create an account
            </Link>
          </p>
        </div>

        {/* Demo hint */}
        <div className="mt-4 p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
          <p className="text-xs text-slate-500 text-center font-medium mb-1">Demo accounts (password: demo123)</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-slate-400 text-center">
            <span>demo@blueregistry.local (NGO)</span>
            <span>admin@blueregistry.local (Admin)</span>
            <span>verifier@blueregistry.local</span>
            <span>buyer@blueregistry.local</span>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
