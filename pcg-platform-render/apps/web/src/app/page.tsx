"use client";

import { useStore } from "../store";
import { AuthPages } from "../components/AuthPages";
import { AppShell } from "../components/AppShell";
import { Toasts } from "../components/Toasts";

export default function Home() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  return (
    <>
      {isAuthenticated ? <AppShell /> : <AuthPages />}
      <Toasts />
    </>
  );
}
