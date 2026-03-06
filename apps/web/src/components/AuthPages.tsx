"use client";

import { useState } from "react";
import { useStore } from "../store";
import { Auth } from "../lib/apiClient";
import { Cloud, LogIn, UserPlus, ArrowLeft, Mail, AlertCircle } from "lucide-react";

type AuthView = "login" | "register" | "forgot";

export function AuthPages() {
  const [view, setView] = useState<AuthView>("login");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gcp-blue rounded-2xl mb-4">
            <Cloud className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gcp-text">PCG Platform</h1>
          <p className="text-gcp-muted text-sm mt-1">Cloud Simulator — Educational Use</p>
          <p className="text-[10px] text-gcp-muted mt-0.5">Not affiliated with Google LLC</p>
        </div>

        <div className="card p-8">
          {view === "login"    && <LoginForm    onSwitch={setView} />}
          {view === "register" && <RegisterForm onSwitch={setView} />}
          {view === "forgot"   && <ForgotForm   onSwitch={setView} />}
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ error }: { error: string }) {
  const isNetwork = error.includes("Cannot reach");
  return (
    <div className={`text-sm p-3 rounded-md border ${isNetwork ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-red-50 border-red-200 text-gcp-red"}`}>
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">{isNetwork ? "API server unreachable" : error}</p>
          {isNetwork && (
            <>
              <p className="text-xs mt-1 opacity-80">{error}</p>
              <p className="text-xs mt-1 font-semibold">Fix: In Render Dashboard → pcg-api → Environment → set CORS_ORIGINS to your pcg-web URL.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const login    = useStore((s) => s.login);
  const addToast = useStore((s) => s.addToast);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      addToast("Welcome back!", "success");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <LogIn className="w-5 h-5 text-gcp-blue" /> Sign In
      </h2>
      {error && <ErrorBox error={error} />}
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input type="email" className="input-field" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Password</label>
        <input type="password" className="input-field" value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign In"}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" onClick={() => onSwitch("forgot")} className="text-gcp-blue hover:underline">
          Forgot password?
        </button>
        <button type="button" onClick={() => onSwitch("register")} className="text-gcp-blue hover:underline">
          Create account
        </button>
      </div>
    </form>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const register = useStore((s) => s.register);
  const addToast = useStore((s) => s.addToast);
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      addToast("Account created!", "success");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-gcp-blue" /> Create Account
      </h2>
      {error && <ErrorBox error={error} />}
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input type="text" className="input-field" value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Your name" required minLength={2} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input type="email" className="input-field" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Password</label>
        <input type="password" className="input-field" value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 chars, 1 uppercase, 1 number" required minLength={8} />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Creating account…" : "Create Account"}
      </button>
      <button type="button" onClick={() => onSwitch("login")}
        className="text-sm text-gcp-blue hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Back to sign in
      </button>
    </form>
  );
}

function ForgotForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const addToast = useStore((s) => s.addToast);
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await Auth.forgotPassword(email);
      setSent(true);
      addToast("Reset link sent if account exists", "info");
    } catch {
      setSent(true); // don't reveal if email exists
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <Mail className="w-12 h-12 text-gcp-blue mx-auto" />
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-gcp-muted">
          If an account with that email exists, we sent a password reset link.
        </p>
        <button type="button" onClick={() => onSwitch("login")} className="btn-primary">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Mail className="w-5 h-5 text-gcp-blue" /> Reset Password
      </h2>
      <p className="text-sm text-gcp-muted">Enter your email and we will send a reset link.</p>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input type="email" className="input-field" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Sending…" : "Send Reset Link"}
      </button>
      <button type="button" onClick={() => onSwitch("login")}
        className="text-sm text-gcp-blue hover:underline flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" /> Back to sign in
      </button>
    </form>
  );
}
