import { describe, expect, it } from "vitest";
import { desktopConfig } from "../electron/config";
import { getNotificationWatcherScript } from "../electron/notification-watcher";
import { isAllowedNavigationUrl } from "../electron/security";

describe("desktopConfig", () => {
  it("uses the hardcoded production server", () => {
    expect(desktopConfig.serverUrl).toBe("https://devilgate-dev.ru");
    expect(desktopConfig.apiBaseUrl).toBe("https://devilgate-dev.ru");
  });

  it("uses a persistent session partition for auth cookies", () => {
    expect(desktopConfig.sessionPartition).toBe("persist:plane");
  });
});

describe("isAllowedNavigationUrl", () => {
  it("allows the configured Plane host", () => {
    expect(isAllowedNavigationUrl("https://devilgate-dev.ru/workspace")).toBe(true);
    expect(isAllowedNavigationUrl("https://devilgate-dev.ru/api/workspaces/test/users/notifications/")).toBe(true);
  });

  it("blocks unknown external hosts", () => {
    expect(isAllowedNavigationUrl("https://evil.example.com/phish")).toBe(false);
  });

  it("allows local offline page", () => {
    expect(isAllowedNavigationUrl("file:///C:/offline.html")).toBe(true);
  });
});

describe("getNotificationWatcherScript", () => {
  it("embeds polling config and API base URL", () => {
    const script = getNotificationWatcherScript(30_000, "https://devilgate-dev.ru");

    expect(script).toContain("var POLL_INTERVAL_MS = 30000");
    expect(script).toContain('"https://devilgate-dev.ru"');
    expect(script).toContain("window.electronAPI.showNotification");
    expect(script).toContain("users/notifications/unread/");
  });

  it("avoids duplicate watcher initialization", () => {
    const script = getNotificationWatcherScript(30_000, "https://devilgate-dev.ru");

    expect(script).toContain("window.__planeDesktopNotificationWatcher");
  });
});
