import type { DesktopAmbxstThemeSnapshot } from "@t3tools/contracts";

export const AMBXST_THEME_BACKGROUND_STORAGE_KEY = "t3code:ambxst-background";
export const AMBXST_THEME_MODE_STORAGE_KEY = "t3code:ambxst-mode";

const THEME_VARIABLES = [
  "--background",
  "--app-chrome-background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
  "--ring",
  "--info",
  "--info-foreground",
  "--success",
  "--success-foreground",
  "--warning",
  "--warning-foreground",
] as const;

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHexColor(value: string): string {
  const normalized = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized;
  }
  return "#000000";
}

function blendHex(base: string, overlay: string, alpha: number): string {
  const safeBase = normalizeHexColor(base);
  const safeOverlay = normalizeHexColor(overlay);
  const ratio = Math.max(0, Math.min(1, alpha));
  const [baseR, baseG, baseB] = [
    Number.parseInt(safeBase.slice(1, 3), 16),
    Number.parseInt(safeBase.slice(3, 5), 16),
    Number.parseInt(safeBase.slice(5, 7), 16),
  ];
  const [overlayR, overlayG, overlayB] = [
    Number.parseInt(safeOverlay.slice(1, 3), 16),
    Number.parseInt(safeOverlay.slice(3, 5), 16),
    Number.parseInt(safeOverlay.slice(5, 7), 16),
  ];

  const mixed = [baseR, baseG, baseB].map((channel, index) =>
    clampChannel(channel * (1 - ratio) + [overlayR, overlayG, overlayB][index]! * ratio),
  );

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function resolveEffectiveColors(snapshot: DesktopAmbxstThemeSnapshot) {
  const { colors } = snapshot;

  if (!snapshot.oledMode || snapshot.mode !== "dark") {
    return {
      background: colors.background,
      surface: colors.surface,
      surfaceBright: colors.surfaceBright,
    };
  }

  return {
    background: "#000000",
    surface: blendHex("#000000", colors.overBackground, 0.1),
    surfaceBright: blendHex("#000000", colors.overBackground, 0.2),
  };
}

export function clearAmbxstThemeVariables(root: HTMLElement): void {
  for (const key of THEME_VARIABLES) {
    root.style.removeProperty(key);
  }
}

export function cacheAmbxstThemeSnapshot(snapshot: DesktopAmbxstThemeSnapshot | null): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  if (!snapshot) {
    localStorage.removeItem(AMBXST_THEME_BACKGROUND_STORAGE_KEY);
    localStorage.removeItem(AMBXST_THEME_MODE_STORAGE_KEY);
    return;
  }

  const effective = resolveEffectiveColors(snapshot);
  localStorage.setItem(AMBXST_THEME_BACKGROUND_STORAGE_KEY, effective.background);
  localStorage.setItem(AMBXST_THEME_MODE_STORAGE_KEY, snapshot.mode);
}

export function applyAmbxstThemeVariables(
  root: HTMLElement,
  snapshot: DesktopAmbxstThemeSnapshot,
): void {
  const { colors } = snapshot;
  const effective = resolveEffectiveColors(snapshot);
  const mutedForeground = blendHex(
    colors.overBackground,
    effective.background,
    snapshot.mode === "dark" ? 0.32 : 0.45,
  );

  root.style.setProperty("--background", effective.background);
  root.style.setProperty("--app-chrome-background", effective.background);
  root.style.setProperty("--foreground", colors.overBackground);
  root.style.setProperty("--card", colors.surfaceContainerHighest);
  root.style.setProperty("--card-foreground", colors.overSurface);
  root.style.setProperty("--popover", colors.surfaceBright);
  root.style.setProperty("--popover-foreground", colors.overSurface);
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-foreground", colors.overPrimary);
  root.style.setProperty("--secondary", colors.surfaceContainerHighest);
  root.style.setProperty("--secondary-foreground", colors.overSurface);
  root.style.setProperty("--muted", colors.surfaceContainerHigh);
  root.style.setProperty("--muted-foreground", mutedForeground);
  root.style.setProperty("--accent", effective.surfaceBright);
  root.style.setProperty("--accent-foreground", colors.overSurface);
  root.style.setProperty("--destructive", colors.error);
  root.style.setProperty("--destructive-foreground", colors.overError);
  root.style.setProperty("--border", colors.outline);
  root.style.setProperty("--input", colors.surfaceBright);
  root.style.setProperty("--ring", colors.primary);
  root.style.setProperty("--info", colors.blue);
  root.style.setProperty("--info-foreground", colors.overBlue);
  root.style.setProperty("--success", colors.green);
  root.style.setProperty("--success-foreground", colors.overGreen);
  root.style.setProperty("--warning", colors.yellow);
  root.style.setProperty("--warning-foreground", colors.overYellow);

  cacheAmbxstThemeSnapshot(snapshot);
}
