import path from "node:path";
import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import { registerApplicationMenu, handleBrowserAuth, handleAuthDeepLink } from "./app-menu";
import { desktopConfig } from "./config";
import { getBrowserAuthButtonScript } from "./browser-auth-ui";
import {
  configureWindowsNotifications,
  initializeWindowsNotifications,
  showDesktopNotification,
  updateMainWindowTitle,
  type DesktopNotificationPayload,
} from "./notifications";
import { startDesktopNotificationPoller } from "./notification-poller";
import { configureAppPaths, configurePlaneSession, registerSessionPersistenceHandlers } from "./session-manager";
import { attachCertificatePolicy, attachNavigationSecurity, isAllowedNavigationUrl } from "./security";
import { getDeepLinkFromArgv, completeAuthFromDeepLink } from "./auth-broker";

configureAppPaths();
registerSessionPersistenceHandlers();
configureWindowsNotifications();

const DESKTOP_PROTOCOL = "plane";

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL);
}

let mainWindow: BrowserWindow | null = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const deepLink = commandLine.find((arg) => arg.startsWith(`${DESKTOP_PROTOCOL}://`));
    if (deepLink) {
      void handleAuthDeepLink(mainWindow, () => completeAuthFromDeepLink(deepLink));
    } else {
      focusMainWindow();
    }
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  void handleAuthDeepLink(mainWindow, () => completeAuthFromDeepLink(url));
});

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: false,
    title: "Plane",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      partition: desktopConfig.sessionPartition,
    },
  });

  attachNavigationSecurity(window.webContents);

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.on("did-finish-load", () => {
    void injectDesktopScripts(window);
  });

  window.webContents.on("did-navigate-in-page", () => {
    void injectDesktopScripts(window);
  });

  window.webContents.on("did-navigate", () => {
    void injectDesktopScripts(window);
  });

  window.webContents.on("did-fail-load", (_event, errorCode, _errorDescription, validatedURL) => {
    if (errorCode === -3) {
      // ERR_ABORTED happens during redirects and route changes.
      return;
    }

    if (validatedURL.startsWith("file://")) {
      return;
    }

    void window.loadFile(path.join(__dirname, "../resources/offline.html"), {
      query: {
        serverUrl: desktopConfig.serverUrl,
      },
    });
  });

  void window.loadURL(desktopConfig.serverUrl);

  return window;
}

async function injectDesktopScripts(window: BrowserWindow): Promise<void> {
  try {
    await window.webContents.executeJavaScript(getBrowserAuthButtonScript(), true);
  } catch (error) {
    console.warn("[Plane Desktop] Failed to inject browser auth UI", error);
  }
}

function focusMainWindow(): void {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function registerNotificationTestShortcut(): void {
  globalShortcut.register("Control+Shift+N", () => {
    showDesktopNotification(
      {
        id: "desktop-test-notification",
        title: "Plane Desktop",
        body: "Test Windows notification — if you see this, native toasts work.",
        url: desktopConfig.serverUrl,
      },
      () => focusMainWindow()
    );
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("desktop:show-notification", (_event, payload: DesktopNotificationPayload) => {
    showDesktopNotification(payload, (clickedPayload) => {
      focusMainWindow();

      if (clickedPayload.url && mainWindow) {
        if (isAllowedNavigationUrl(clickedPayload.url)) {
          void mainWindow.loadURL(clickedPayload.url);
        }
      }
    });
  });

  ipcMain.handle("desktop:set-unread-count", (_event, count: number) => {
    updateMainWindowTitle(mainWindow, count);
  });

  ipcMain.handle("desktop:start-browser-auth", async () => handleBrowserAuth(mainWindow));
}

void app.whenReady().then(() => {
  initializeWindowsNotifications();
  configurePlaneSession();
  attachCertificatePolicy();
  registerIpcHandlers();
  registerApplicationMenu(() => mainWindow);

  mainWindow = createMainWindow();
  registerNotificationTestShortcut();

  startDesktopNotificationPoller(
    desktopConfig.pollIntervalMs,
    (url) => {
      focusMainWindow();

      if (url && mainWindow && isAllowedNavigationUrl(url)) {
        void mainWindow.loadURL(url);
      }
    },
    () => mainWindow
  );

  const launchDeepLink = getDeepLinkFromArgv(process.argv);
  if (launchDeepLink) {
    void handleAuthDeepLink(mainWindow, () => completeAuthFromDeepLink(launchDeepLink));
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      focusMainWindow();
    }
  });

  return undefined;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
