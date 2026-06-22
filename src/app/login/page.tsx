"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/app/actions/authActions";
import { Trophy, Activity, Mail, Lock } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);

      const res = await loginAction(null, formData);

      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        // Redirect based on role or search parameter
        const target = redirectPath || (res.role === "ADMIN" ? "/admin" : "/referee");
        router.push(target);
        router.refresh();
      }
    });
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-black text-white min-h-screen">
      <div className="w-full max-w-md">
        {/* Brand/Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm mb-4 transition-transform hover:scale-105 duration-305">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Antigravity Score
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Live Pickleball Tournament Portal
          </p>
        </div>

        {/* Login Card with Glassmorphism */}
        <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 text-white">
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 border-2 border-dashed border-white bg-black text-white text-sm rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-550">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="admin@tournament.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-zinc-800 focus:border-white rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-650 focus:outline-none transition-all text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-550">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-805 focus:border-white rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-655 focus:outline-none transition-all text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-white hover:bg-zinc-200 text-black rounded-xl py-3.5 px-4 font-bold text-sm focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm"
            >
              {isPending ? (
                <>
                  <Activity className="animate-spin h-5 w-5 text-black" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Seed accounts info helper */}
          <div className="mt-8 pt-6 border-t border-zinc-850 text-center text-xs text-zinc-500">
            <p className="font-semibold text-zinc-405 mb-2">Seed accounts for local testing:</p>
            <div className="space-y-1 bg-black p-3 rounded-lg border border-zinc-800">
              <p>Admin: <code className="text-white font-mono font-bold">admin@tournament.com</code></p>
              <p>Referee: <code className="text-white font-mono font-bold">ref@tournament.com</code></p>
              <p>Password: <code className="text-zinc-300 font-mono">password123</code></p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-xs text-zinc-500 hover:text-white underline transition-colors"
          >
            ← Back to Live Public Leaderboard
          </a>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-black text-white min-h-screen">
        <div className="text-center space-y-4">
          <Trophy className="w-12 h-12 text-white mx-auto animate-pulse" />
          <p className="text-zinc-400 text-sm">Loading login portal...</p>
        </div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
