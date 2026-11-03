"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type AuthAwareShellProps = {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  bottomNav: ReactNode;
  pwaInstallButton: ReactNode;
  iosInstallBanner: ReactNode;
};

const AUTH_PATHS = new Set(["/login", "/signup"]);

/** Keep authentication pages focused while preserving the app-wide shell elsewhere. */
export function AuthAwareShell({
  children,
  header,
  footer,
  bottomNav,
  pwaInstallButton,
  iosInstallBanner,
}: AuthAwareShellProps) {
  const pathname = usePathname();
  const normalizedPath = pathname?.replace(/\/+$/, "") || "/";
  const isAuthPage = AUTH_PATHS.has(normalizedPath);

  return (
    <>
      {!isAuthPage ? header : null}
      <main
        className={
          isAuthPage
            ? "flex min-h-[100dvh] w-full items-center justify-center px-5 py-10"
            : "safe-bottom mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl"
        }
        style={
          isAuthPage
            ? {
                backgroundColor: "#0B0E14",
                backgroundImage:
                  "radial-gradient(ellipse at top, rgba(223, 178, 96, 0.10), transparent 56%)",
              }
            : undefined
        }
      >
        {isAuthPage ? <div className="w-full max-w-md">{children}</div> : children}
      </main>
      {!isAuthPage ? footer : null}
      {!isAuthPage ? bottomNav : null}
      {!isAuthPage ? pwaInstallButton : null}
      {!isAuthPage ? iosInstallBanner : null}
    </>
  );
}
