import { BrowserWindow, Menu, shell, dialog } from "electron";
import { desktopConfig } from "./config";
import { startBrowserAuth } from "./auth-broker";

export function registerApplicationMenu(getMainWindow: () => BrowserWindow | null): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Plane",
      submenu: [
        {
          label: "Sign in with browser",
          accelerator: "CommandOrControl+Shift+B",
          click: () => {
            void handleBrowserAuth(getMainWindow());
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Open Plane in browser",
          click: () => {
            void shell.openExternal(desktopConfig.serverUrl);
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function reloadAuthenticatedApp(mainWindow: BrowserWindow): Promise<void> {
  await mainWindow.webContents.session.clearCache();
  await mainWindow.loadURL(desktopConfig.serverUrl, {
    extraHeaders: "Cache-Control: no-cache\r\nPragma: no-cache\r\n",
  });
  mainWindow.show();
  mainWindow.focus();
}

export async function handleBrowserAuth(
  mainWindow: BrowserWindow | null
): Promise<{ success: boolean; error?: string }> {
  const result = await startBrowserAuth();

  if (result.success && mainWindow) {
    await reloadAuthenticatedApp(mainWindow);
    return result;
  }

  if (result.error) {
    if (mainWindow) {
      void dialog.showErrorBox("Plane Desktop sign-in failed", result.error);
    } else {
      void dialog.showErrorBox("Plane Desktop sign-in failed", result.error);
    }
  }

  return result;
}

export async function handleAuthDeepLink(
  mainWindow: BrowserWindow | null,
  completeAuth: () => Promise<{ success: boolean; error?: string }>
): Promise<void> {
  const result = await completeAuth();

  if (result.success && mainWindow) {
    await reloadAuthenticatedApp(mainWindow);
    return;
  }

  if (result.error) {
    void dialog.showErrorBox("Plane Desktop sign-in failed", result.error);
  }

  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}
