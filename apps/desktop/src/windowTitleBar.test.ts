import { describe, expect, it } from "vitest";
import type { ClientSettings } from "@t3tools/contracts";

import {
  getWindowTitleBarOptions,
  shouldRelaunchForClientSettingsChange,
} from "./windowTitleBar.ts";

const baseClientSettings: ClientSettings = {
  autoOpenPlanSidebar: true,
  confirmThreadArchive: false,
  confirmThreadDelete: true,
  diffIgnoreWhitespace: true,
  diffWordWrap: false,
  hideWindowControls: false,
  favorites: [],
  providerModelPreferences: {},
  sidebarProjectGroupingMode: "repository",
  sidebarProjectGroupingOverrides: {},
  sidebarProjectSortOrder: "updated_at",
  sidebarThreadSortOrder: "updated_at",
  timestampFormat: "locale",
};

describe("getWindowTitleBarOptions", () => {
  it("keeps the default Linux titlebar when controls are visible", () => {
    expect(
      getWindowTitleBarOptions({
        platform: "linux",
        hideWindowControls: false,
      }),
    ).toEqual({
      titleBarStyle: "default",
    });
  });

  it("hides Linux controls by removing the overlay", () => {
    expect(
      getWindowTitleBarOptions({
        platform: "linux",
        hideWindowControls: true,
      }),
    ).toEqual({
      titleBarStyle: "hidden",
    });
  });

  it("keeps macOS traffic lights visible when controls are not hidden", () => {
    expect(
      getWindowTitleBarOptions({
        platform: "darwin",
        hideWindowControls: false,
      }),
    ).toEqual({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 18 },
    });
  });
});

describe("shouldRelaunchForClientSettingsChange", () => {
  it("relaunches when hideWindowControls changes", () => {
    expect(
      shouldRelaunchForClientSettingsChange(baseClientSettings, {
        ...baseClientSettings,
        hideWindowControls: true,
      }),
    ).toBe(true);
  });

  it("does not relaunch for unrelated client setting changes", () => {
    expect(
      shouldRelaunchForClientSettingsChange(baseClientSettings, {
        ...baseClientSettings,
        diffWordWrap: true,
      }),
    ).toBe(false);
  });
});
