"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ROLE_OPTIONS = [
  { value: "NGO", label: "NGO / Project Developer" },
  { value: "COMMUNITY", label: "Coastal Community Representative" },
  { value: "VERIFIER", label: "Technical Verifier" },
  { value: "BUYER", label: "Buyer / Observer" },
];

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("NGO");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // Redirect to login with success flag
      router.push("/login?registered=true");
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
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Create an Account</h1>
          <p className="text-sm text-slate-400 mt-2">Join the BlueRegistry platform</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500/50 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              placeholder="e.g. Asha Roy"
            />
          </div>

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
              placeholder="e.g. asha@restoration.org"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500/50 rounded-lg px-4 py-3 text-slate-200 focus:outline-none transition-colors"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500/50 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              placeholder="Re-enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/50 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-emerald-500/25 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-800/60 pt-6">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
              Sign in instead
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
