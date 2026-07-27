import { describe, expect, it } from "vitest";
import { DESKTOP_AUTH_REDIRECT_URI, getDeepLinkFromArgv, handleAuthCallbackUrl } from "../electron/auth-broker";
import { desktopConfig } from "../electron/config";
import { getNotificationWatcherScript } from "../electron/notification-watcher";
import { isAllowedNavigationUrl } from "../electron/security";

describe("desktop auth protocol", () => {
  it("uses plane:// callback redirect URI", () => {
    expect(DESKTOP_AUTH_REDIRECT_URI).toBe("plane://auth/callback");
  });

  it("parses auth callback deep links from argv", () => {
    expect(getDeepLinkFromArgv(["Plane.exe", "plane://auth/callback?code=abc"])).toBe("plane://auth/callback?code=abc");
  });

  it("accepts plane:// callback URLs", () => {
    expect(handleAuthCallbackUrl("plane://auth/callback?code=test-code")).toBe(true);
  });

  it("rejects unrelated deep links", () => {
    expect(handleAuthCallbackUrl("plane://other/path?code=test-code")).toBe(false);
  });
});

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
    expect(script).toContain("/api/users/me/workspaces/");
    expect(script).toContain("window.__planeDesktopPollNow");
  });

  it("avoids duplicate watcher initialization", () => {
    const script = getNotificationWatcherScript(30_000, "https://devilgate-dev.ru");

    expect(script).toContain("window.__planeDesktopNotificationWatcher");
  });
});
