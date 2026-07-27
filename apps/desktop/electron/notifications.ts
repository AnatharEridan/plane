import path from "node:path";
import { app, BrowserWindow, Notification, nativeImage } from "electron";
import { desktopConfig } from "./config";

export type DesktopNotificationPayload = {
  id: string;
  title: string;
  body: string;
  url?: string;
};

let iconPath: string | undefined;

function getNotificationIcon(): string | undefined {
  if (iconPath) {
    return iconPath;
  }

  const candidates = [path.join(__dirname, "../resources/icon.png"), path.join(__dirname, "../resources/icon.ico")];

  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      iconPath = candidate;
      return iconPath;
    }
  }

  return undefined;
}

export function configureWindowsNotifications(): void {
  if (process.platform === "win32") {
    app.setAppUserModelId(desktopConfig.appUserModelId);
  }
}

export function showDesktopNotification(
  payload: DesktopNotificationPayload,
  onClick?: (payload: DesktopNotificationPayload) => void
): void {
  if (!Notification.isSupported()) {
    return;
  }

  const notification = new Notification({
    title: payload.title,
    body: payload.body,
    icon: getNotificationIcon(),
    silent: false,
  });

  notification.on("click", () => {
    onClick?.(payload);
  });

  notification.show();
}

export function updateTaskbarBadge(mainWindow: BrowserWindow | null, unreadCount: number): void {
  if (!mainWindow || process.platform !== "win32") {
    return;
  }

  if (unreadCount > 0) {
    mainWindow.flashFrame(true);
  } else {
    mainWindow.flashFrame(false);
  }
}
