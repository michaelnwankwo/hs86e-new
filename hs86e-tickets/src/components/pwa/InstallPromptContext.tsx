"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __HS86E_DEFERRED_PROMPT?: BeforeInstallPromptEvent | null;
  }
}

type InstallContextValue = {
  standalone: boolean;
  canPrompt: boolean;
  installed: boolean;
  ready: boolean;
  isIOS: boolean;
  iosHintOpen: boolean;
  hint: string | null;
  install: () => Promise<void>;
  dismissHint: () => void;
  dismissIosHint: () => void;
};

const IOS_HINT_KEY = "hs86e_ios_install_hint";
/** One-shot guard so a service-worker-triggered reload happens at most once per tab session. */
const SW_RELOAD_KEY = "hs86e_sw_upgrade_reload";
const InstallPromptContext = createContext<InstallContextValue | null>(null);

function readStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function readIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOSDevice = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const notOther = !/crios|fxios|edgios|opios/i.test(ua);
  return iOSDevice && notOther;
}

function grabStoredPrompt() {
  return window.__HS86E_DEFERRED_PROMPT ?? null;
}

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ready, setReady] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const ios = readIOS();
    const alone = readStandalone();
    setIsIOS(ios);
    setStandalone(alone);
    if (ios && !alone && sessionStorage.getItem(IOS_HINT_KEY) !== "1") {
      setIosHintOpen(true);
    }

    const stored = grabStoredPrompt();
    if (stored) setPromptEvent(stored);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      const deferred = event as BeforeInstallPromptEvent;
      window.__HS86E_DEFERRED_PROMPT = deferred;
      setPromptEvent(deferred);
    };
    const onReady = () => {
      const next = grabStoredPrompt();
      if (next) setPromptEvent(next);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      window.__HS86E_DEFERRED_PROMPT = null;
      setHint(null);
      setIosHintOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("hs86e-install-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);

    let onControllerChange: (() => void) | undefined;
    if ("serviceWorker" in navigator) {
      // Deployment coherence: when a NEW service worker activates and takes
      // control mid-session (skipWaiting + clientsClaim after a redeploy),
      // this page's already-fetched JS chunks now belong to the OLD build
      // while the new SW only precaches the NEW ones. Lazy chunk requests
      // then 404, hydration fails, and any loading UI shipped in the SSR HTML
      // would sit on screen forever. Reload ONCE so HTML, chunks, and the
      // precache come from the same build. Skipped on the very first install,
      // when nothing was controlling the page before.
      const hadController = Boolean(navigator.serviceWorker.controller);
      onControllerChange = () => {
        if (!hadController) return;
        if (sessionStorage.getItem(SW_RELOAD_KEY) === "1") return;
        sessionStorage.setItem(SW_RELOAD_KEY, "1");
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

      const swUrl = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw-dev.js";
      navigator.serviceWorker
        .register(swUrl, { scope: "/", updateViaCache: "none" })
        .then((reg) => reg.update())
        .then(() => navigator.serviceWorker.ready)
        .then(() => setReady(true))
        .catch(() => setReady(true));
    } else {
      setReady(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("hs86e-install-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
      if (onControllerChange) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
    };
  }, []);

  const dismissIosHint = useCallback(() => {
    setIosHintOpen(false);
    sessionStorage.setItem(IOS_HINT_KEY, "1");
  }, []);

  const install = useCallback(async () => {
    const deferred = promptEvent || grabStoredPrompt();
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setPromptEvent(null);
        window.__HS86E_DEFERRED_PROMPT = null;
      }
      return;
    }
    if (isIOS) {
      setIosHintOpen(true);
      return;
    }
    setHint("Use the browser menu → Install app / Add to Home Screen.");
  }, [promptEvent, isIOS]);

  const value = useMemo(
    () => ({
      standalone,
      canPrompt: Boolean(promptEvent),
      installed,
      ready,
      isIOS,
      iosHintOpen,
      hint,
      install,
      dismissHint: () => setHint(null),
      dismissIosHint,
    }),
    [standalone, promptEvent, installed, ready, isIOS, iosHintOpen, hint, install, dismissIosHint],
  );

  return <InstallPromptContext.Provider value={value}>{children}</InstallPromptContext.Provider>;
}

export function useInstallPrompt() {
  const ctx = useContext(InstallPromptContext);
  if (!ctx) {
    throw new Error("useInstallPrompt must be used within InstallPromptProvider");
  }
  return ctx;
}
