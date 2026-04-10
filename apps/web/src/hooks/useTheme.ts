import type { DesktopAmbxstThemeSnapshot, DesktopTheme } from "@t3tools/contracts";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  applyAmbxstThemeVariables,
  cacheAmbxstThemeSnapshot,
  clearAmbxstThemeVariables,
} from "../theme/ambxstTheme";

export type Theme = "light" | "dark" | "system" | "ambxst";

type ThemeSnapshot = {
  theme: Theme;
  systemDark: boolean;
  ambxstAvailable: boolean;
  ambxstDark: boolean;
};

const STORAGE_KEY = "t3code:theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const DEFAULT_THEME_SNAPSHOT: ThemeSnapshot = {
  theme: "system",
  systemDark: false,
  ambxstAvailable: false,
  ambxstDark: false,
};
const THEME_COLOR_META_NAME = "theme-color";
const DYNAMIC_THEME_COLOR_SELECTOR = `meta[name="${THEME_COLOR_META_NAME}"][data-dynamic-theme-color="true"]`;

let listeners: Array<() => void> = [];
let lastSnapshot: ThemeSnapshot | null = null;
let lastDesktopTheme: DesktopTheme | null = null;
let ambxstThemeSnapshot: DesktopAmbxstThemeSnapshot | null = null;
let ambxstThemeRequest: Promise<void> | null = null;
let ambxstSubscribed = false;

function emitChange() {
  for (const listener of listeners) listener();
}

function hasThemeStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getSystemDark() {
  return typeof window !== "undefined" && window.matchMedia(MEDIA_QUERY).matches;
}

function getStored(): Theme {
  if (!hasThemeStorage()) return DEFAULT_THEME_SNAPSHOT.theme;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system" || raw === "ambxst") return raw;
  return "system";
}

function hasAmbxstBridge() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.desktopBridge &&
      typeof window.desktopBridge.getAmbxstTheme === "function" &&
      typeof window.desktopBridge.onAmbxstTheme === "function",
  );
}

function ensureThemeColorMetaTag(): HTMLMetaElement {
  let element = document.querySelector<HTMLMetaElement>(DYNAMIC_THEME_COLOR_SELECTOR);
  if (element) {
    return element;
  }

  element = document.createElement("meta");
  element.name = THEME_COLOR_META_NAME;
  element.setAttribute("data-dynamic-theme-color", "true");
  document.head.append(element);
  return element;
}

function normalizeThemeColor(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (
    !normalizedValue ||
    normalizedValue === "transparent" ||
    normalizedValue === "rgba(0, 0, 0, 0)" ||
    normalizedValue === "rgba(0 0 0 / 0)"
  ) {
    return null;
  }

  return value?.trim() ?? null;
}

function resolveBrowserChromeSurface(): HTMLElement {
  return (
    document.querySelector<HTMLElement>("main[data-slot='sidebar-inset']") ??
    document.querySelector<HTMLElement>("[data-slot='sidebar-inner']") ??
    document.body
  );
}

export function syncBrowserChromeTheme() {
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") return;
  const surfaceColor = normalizeThemeColor(
    getComputedStyle(resolveBrowserChromeSurface()).backgroundColor,
  );
  const fallbackColor = normalizeThemeColor(getComputedStyle(document.body).backgroundColor);
  const backgroundColor = surfaceColor ?? fallbackColor;
  if (!backgroundColor) return;

  document.documentElement.style.backgroundColor = backgroundColor;
  document.body.style.backgroundColor = backgroundColor;
  ensureThemeColorMetaTag().setAttribute("content", backgroundColor);
}

function setAmbxstThemeSnapshot(snapshot: DesktopAmbxstThemeSnapshot | null): void {
  ambxstThemeSnapshot = snapshot;
  cacheAmbxstThemeSnapshot(snapshot);
  if (getStored() === "ambxst") {
    applyTheme("ambxst", true);
  }
  emitChange();
}

function requestAmbxstTheme(): void {
  if (!hasAmbxstBridge() || ambxstThemeRequest) {
    return;
  }

  ambxstThemeRequest = window
    .desktopBridge!.getAmbxstTheme()
    .then((snapshot) => {
      setAmbxstThemeSnapshot(snapshot);
    })
    .catch(() => {
      setAmbxstThemeSnapshot(null);
    })
    .finally(() => {
      ambxstThemeRequest = null;
    });
}

function ensureAmbxstSubscription(): void {
  if (!hasAmbxstBridge() || ambxstSubscribed) {
    return;
  }

  ambxstSubscribed = true;
  window.desktopBridge!.onAmbxstTheme((snapshot) => {
    setAmbxstThemeSnapshot(snapshot);
  });
  requestAmbxstTheme();
}

function resolveIsDark(theme: Theme): boolean {
  if (theme === "light") return false;
  if (theme === "dark") return true;
  if (theme === "ambxst") {
    return ambxstThemeSnapshot?.mode === "dark";
  }
  return getSystemDark();
}

function resolveDesktopTheme(theme: Theme): DesktopTheme {
  if (theme === "ambxst") {
    return ambxstThemeSnapshot?.mode ?? "system";
  }
  return theme;
}

function applyTheme(theme: Theme, suppressTransitions = false) {
  if (typeof document === "undefined") return;

  if (theme === "ambxst") {
    ensureAmbxstSubscription();
    if (ambxstThemeSnapshot) {
      applyAmbxstThemeVariables(document.documentElement, ambxstThemeSnapshot);
    } else {
      clearAmbxstThemeVariables(document.documentElement);
    }
  } else {
    clearAmbxstThemeVariables(document.documentElement);
  }

  if (suppressTransitions) {
    document.documentElement.classList.add("no-transitions");
  }

  document.documentElement.classList.toggle("dark", resolveIsDark(theme));
  syncBrowserChromeTheme();
  syncDesktopTheme(theme);

  if (suppressTransitions) {
    // Force a reflow so the no-transitions class takes effect before removal
    // oxlint-disable-next-line no-unused-expressions
    document.documentElement.offsetHeight;
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("no-transitions");
    });
  }
}

function syncDesktopTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const bridge = window.desktopBridge;
  const desktopTheme = resolveDesktopTheme(theme);
  if (!bridge || lastDesktopTheme === desktopTheme) {
    return;
  }

  lastDesktopTheme = desktopTheme;
  void bridge.setTheme(desktopTheme).catch(() => {
    if (lastDesktopTheme === desktopTheme) {
      lastDesktopTheme = null;
    }
  });
}

ensureAmbxstSubscription();

// Apply immediately on module load to prevent flash
if (typeof document !== "undefined" && hasThemeStorage()) {
  applyTheme(getStored());
}

function getSnapshot(): ThemeSnapshot {
  if (!hasThemeStorage()) return DEFAULT_THEME_SNAPSHOT;
  const theme = getStored();
  const systemDark = theme === "system" ? getSystemDark() : false;
  const ambxstDark = ambxstThemeSnapshot?.mode === "dark";
  const ambxstAvailable = ambxstThemeSnapshot !== null;

  if (
    lastSnapshot &&
    lastSnapshot.theme === theme &&
    lastSnapshot.systemDark === systemDark &&
    lastSnapshot.ambxstDark === ambxstDark &&
    lastSnapshot.ambxstAvailable === ambxstAvailable
  ) {
    return lastSnapshot;
  }

  lastSnapshot = { theme, systemDark, ambxstDark, ambxstAvailable };
  return lastSnapshot;
}

function getServerSnapshot() {
  return DEFAULT_THEME_SNAPSHOT;
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.push(listener);
  ensureAmbxstSubscription();

  const mq = window.matchMedia(MEDIA_QUERY);
  const handleChange = () => {
    if (getStored() === "system") applyTheme("system", true);
    emitChange();
  };
  mq.addEventListener("change", handleChange);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const nextTheme = getStored();
      if (nextTheme === "ambxst") {
        requestAmbxstTheme();
      }
      applyTheme(nextTheme, true);
      emitChange();
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners = listeners.filter((l) => l !== listener);
    mq.removeEventListener("change", handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const theme = snapshot.theme;

  const resolvedTheme: "light" | "dark" =
    theme === "system"
      ? snapshot.systemDark
        ? "dark"
        : "light"
      : theme === "ambxst"
        ? snapshot.ambxstDark
          ? "dark"
          : "light"
        : theme;

  const setTheme = useCallback((next: Theme) => {
    if (!hasThemeStorage()) return;
    localStorage.setItem(STORAGE_KEY, next);
    if (next === "ambxst") {
      requestAmbxstTheme();
    }
    applyTheme(next, true);
    emitChange();
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme, resolvedTheme, ambxstAvailable: snapshot.ambxstAvailable } as const;
}
