import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import type { DesktopAmbxstPalette, DesktopAmbxstThemeSnapshot } from "@t3tools/contracts";

const AMBXST_COLORS_PATH = Path.join(OS.homedir(), ".cache", "ambxst", "colors.json");
const AMBXST_THEME_PATH = Path.join(OS.homedir(), ".config", "ambxst", "config", "theme.json");

type AmbxstThemeListener = (snapshot: DesktopAmbxstThemeSnapshot | null) => void;

type RawAmbxstThemeConfig = {
  readonly lightMode?: unknown;
  readonly oledMode?: unknown;
  readonly roundness?: unknown;
  readonly font?: unknown;
  readonly monoFont?: unknown;
};

const REQUIRED_PALETTE_KEYS = [
  "background",
  "surface",
  "surfaceBright",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
  "surfaceContainerLow",
  "surfaceContainerLowest",
  "surfaceDim",
  "surfaceTint",
  "surfaceVariant",
  "outline",
  "outlineVariant",
  "primary",
  "primaryContainer",
  "secondary",
  "secondaryContainer",
  "tertiary",
  "tertiaryContainer",
  "error",
  "errorContainer",
  "blue",
  "green",
  "yellow",
  "overBackground",
  "overSurface",
  "overSurfaceVariant",
  "overPrimary",
  "overPrimaryContainer",
  "overSecondary",
  "overSecondaryContainer",
  "overTertiary",
  "overTertiaryContainer",
  "overError",
  "overErrorContainer",
  "overBlue",
  "overGreen",
  "overYellow",
  "shadow",
  "sourceColor",
] as const satisfies readonly (keyof DesktopAmbxstPalette)[];

function readJsonFile(path: string): unknown | null {
  try {
    return JSON.parse(FS.readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPalette(input: unknown): DesktopAmbxstPalette | null {
  if (!isRecord(input)) {
    return null;
  }

  const palette: Partial<Record<keyof DesktopAmbxstPalette, string>> = {};

  for (const key of REQUIRED_PALETTE_KEYS) {
    const value = input[key];
    if (typeof value !== "string") {
      return null;
    }
    palette[key] = value;
  }

  return palette as DesktopAmbxstPalette;
}

export function readAmbxstThemeSnapshot(): DesktopAmbxstThemeSnapshot | null {
  const colors = readPalette(readJsonFile(AMBXST_COLORS_PATH));
  const rawTheme = readJsonFile(AMBXST_THEME_PATH) as RawAmbxstThemeConfig | null;

  if (!colors || !rawTheme) {
    return null;
  }

  const lightMode = rawTheme.lightMode === true;
  const oledMode = !lightMode && rawTheme.oledMode === true;

  return {
    mode: lightMode ? "light" : "dark",
    oledMode,
    roundness: typeof rawTheme.roundness === "number" ? rawTheme.roundness : 16,
    font: typeof rawTheme.font === "string" ? rawTheme.font : "DM Sans",
    monoFont: typeof rawTheme.monoFont === "string" ? rawTheme.monoFont : "SF Mono",
    colors,
  };
}

export class AmbxstThemeMonitor {
  private readonly listeners = new Set<AmbxstThemeListener>();
  private readonly watchers: FS.FSWatcher[] = [];
  private lastSerializedSnapshot: string | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshot: DesktopAmbxstThemeSnapshot | null = null;

  constructor() {
    this.snapshot = readAmbxstThemeSnapshot();
    this.lastSerializedSnapshot = this.serialize(this.snapshot);
    this.watchDirectory(Path.dirname(AMBXST_COLORS_PATH), "colors.json");
    this.watchDirectory(Path.dirname(AMBXST_THEME_PATH), "theme.json");
  }

  getSnapshot(): DesktopAmbxstThemeSnapshot | null {
    return this.snapshot;
  }

  subscribe(listener: AmbxstThemeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers.length = 0;
    this.listeners.clear();
  }

  private serialize(snapshot: DesktopAmbxstThemeSnapshot | null): string | null {
    return snapshot ? JSON.stringify(snapshot) : null;
  }

  private emit(snapshot: DesktopAmbxstThemeSnapshot | null): void {
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private refresh(): void {
    const nextSnapshot = readAmbxstThemeSnapshot();
    const serialized = this.serialize(nextSnapshot);

    if (serialized === this.lastSerializedSnapshot) {
      return;
    }

    this.snapshot = nextSnapshot;
    this.lastSerializedSnapshot = serialized;
    this.emit(nextSnapshot);
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refresh();
    }, 120);
  }

  private watchDirectory(directoryPath: string, fileName: string): void {
    if (!FS.existsSync(directoryPath)) {
      return;
    }

    try {
      const watcher = FS.watch(directoryPath, { persistent: false }, (_eventType, changedPath) => {
        if (typeof changedPath === "string" && changedPath !== "" && changedPath !== fileName) {
          return;
        }
        this.scheduleRefresh();
      });
      this.watchers.push(watcher);
    } catch {
      // Ignore watch failures and keep one-shot reads available.
    }
  }
}
