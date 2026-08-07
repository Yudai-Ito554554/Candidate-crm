import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

interface TauriWindowConfig {
  label?: string;
  dragDropEnabled?: boolean;
}

interface TauriConfig {
  app?: {
    windows?: TauriWindowConfig[];
  };
}

describe("Tauri file drag and drop", () => {
  it("lets the React frontend receive HTML5 drop events on macOS and Windows", async () => {
    const source = await readFile(
      path.resolve(process.cwd(), "src-tauri/tauri.conf.json"),
      "utf8",
    );
    const config = JSON.parse(source) as TauriConfig;
    const windows = config.app?.windows ?? [];
    const mainWindow =
      windows.find((window) => window.label === "main") ?? windows[0];

    expect(mainWindow).toBeDefined();
    expect(mainWindow?.dragDropEnabled).toBe(false);
  });
});
