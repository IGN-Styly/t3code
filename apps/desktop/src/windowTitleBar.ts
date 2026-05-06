import type { BrowserWindowConstructorOptions } from "electron";
import type { ClientSettings } from "@t3tools/contracts";

export type WindowTitleBarOptions = Pick<
  BrowserWindowConstructorOptions,
  "titleBarOverlay" | "titleBarStyle" | "trafficLightPosition"
>;

export function getWindowTitleBarOptions(input: {
  readonly platform: NodeJS.Platform;
  readonly hideWindowControls: boolean;
}): WindowTitleBarOptions {
  const { platform, hideWindowControls } = input;

  if (platform === "darwin") {
    if (hideWindowControls) {
      return { titleBarStyle: "hidden" };
    }
    return {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 18 },
    };
  }

  if (hideWindowControls) {
    return {
      titleBarStyle: "hidden",
    };
  }

  return { titleBarStyle: "default" };
}

export function shouldRelaunchForClientSettingsChange(
  previousSettings: ClientSettings,
  nextSettings: ClientSettings,
): boolean {
  return previousSettings.hideWindowControls !== nextSettings.hideWindowControls;
}
