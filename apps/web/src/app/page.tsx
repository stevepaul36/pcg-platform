"use client";

import { useEffect, useState } from "react";
import { useStore } from "../store";
import { AuthPages } from "../components/AuthPages";
import { AppShell } from "../components/AppShell";
import { Toasts } from "../components/Toasts";

export default function Home() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch: localStorage state only available client-side.
  // Show nothing on first SSR pass; render correct component after mount.
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <>
      {isAuthenticated ? <AppShell /> : <AuthPages />}
      <Toasts />
    </>
  );
}
