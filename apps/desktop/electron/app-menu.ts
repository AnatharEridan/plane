import { BrowserWindow, Menu, shell } from "electron";
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

export async function handleBrowserAuth(mainWindow: BrowserWindow | null): Promise<void> {
  const result = await startBrowserAuth();

  if (result.success && mainWindow) {
    void mainWindow.loadURL(desktopConfig.serverUrl);
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  if (mainWindow && result.error) {
    void mainWindow.webContents.executeJavaScript(`window.alert(${JSON.stringify(result.error)});`, true);
  }
}
