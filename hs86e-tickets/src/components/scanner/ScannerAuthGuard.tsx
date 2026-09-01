"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StaffPinGate } from "@/components/scanner/StaffPinGate";

async function revokeStaffSession() {
  try {
    await fetch("/api/scan/auth", { method: "DELETE", keepalive: true });
  } catch {
    // lock locally even if the network call fails
  }
}

export function ScannerAuthGuard({
  demoHint,
  children,
}: {
  demoHint?: boolean;
  children: ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const unlockedRef = useRef(false);

  const lock = useCallback(() => {
    if (!unlockedRef.current) return;
    unlockedRef.current = false;
    setUnlocked(false);
    void revokeStaffSession();
  }, []);

  const unlock = useCallback(() => {
    unlockedRef.current = true;
    setUnlocked(true);
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") lock();
    };
    const onPageHide = () => lock();
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      lock();
    };
  }, [lock]);

  if (!unlocked) {
    return <StaffPinGate demoHint={demoHint} onUnlocked={unlock} />;
  }

  return <>{children}</>;
}
