import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, Notification, nativeImage, shell } from "electron";
import notifier from "node-notifier";
import { desktopConfig } from "./config";

export type DesktopNotificationPayload = {
  id: string;
  title: string;
  body: string;
  url?: string;
};

const activeNotifications = new Map<string, Notification>();
let notificationIconPath: string | undefined;

function getResourcesDirectory(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app", "resources");
  }

  return path.join(__dirname, "../resources");
}

function getNotificationIconPath(): string | undefined {
  if (notificationIconPath && fs.existsSync(notificationIconPath)) {
    return notificationIconPath;
  }

  const candidates = [
    path.join(getResourcesDirectory(), "icon.png"),
    path.join(getResourcesDirectory(), "icon.ico"),
    path.join(__dirname, "../resources/icon.png"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      notificationIconPath = candidate;
      return notificationIconPath;
    }
  }

  return undefined;
}

function getNotificationIconImage(): Electron.NativeImage | undefined {
  const iconPath = getNotificationIconPath();
  if (!iconPath) {
    return undefined;
  }

  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    return undefined;
  }

  return image.resize({ width: 256, height: 256 });
}

function ensureWindowsNotificationShortcut(): void {
  if (process.platform !== "win32" || !app.isPackaged) {
    return;
  }

  const shortcutDirectory = path.join(app.getPath("appData"), "Plane");
  const shortcutPath = path.join(shortcutDirectory, "Plane.lnk");

  if (fs.existsSync(shortcutPath)) {
    return;
  }

  fs.mkdirSync(shortcutDirectory, { recursive: true });

  shell.writeShortcutLink(shortcutPath, {
    target: process.execPath,
    cwd: path.dirname(process.execPath),
    description: "Plane Desktop",
    appUserModelId: desktopConfig.appUserModelId,
    icon: process.execPath,
    iconIndex: 0,
  });
}

export function configureWindowsNotifications(): void {
  if (process.platform !== "win32") {
    return;
  }

  app.setAppUserModelId(desktopConfig.appUserModelId);
}

export function initializeWindowsNotifications(): void {
  ensureWindowsNotificationShortcut();
}

function showWindowsToast(
  payload: DesktopNotificationPayload,
  onClick?: (payload: DesktopNotificationPayload) => void
): void {
  const icon = getNotificationIconPath();

  notifier.notify(
    {
      appID: desktopConfig.appUserModelId,
      title: payload.title,
      message: payload.body,
      icon,
      sound: true,
      wait: true,
    },
    (error, response) => {
      if (error) {
        console.warn("[Plane Desktop] node-notifier failed:", error);
        return;
      }

      if (response === "activate") {
        onClick?.(payload);
      }
    }
  );
}

function showElectronNotification(
  payload: DesktopNotificationPayload,
  onClick?: (payload: DesktopNotificationPayload) => void
): void {
  if (!Notification.isSupported()) {
    return;
  }

  const icon = getNotificationIconImage();
  const notification = new Notification({
    title: payload.title,
    body: payload.body,
    icon: icon && !icon.isEmpty() ? icon : undefined,
    silent: false,
  });

  activeNotifications.set(payload.id, notification);

  notification.on("click", () => {
    onClick?.(payload);
  });

  notification.on("close", () => {
    activeNotifications.delete(payload.id);
  });

  notification.on("failed", (_event, error) => {
    activeNotifications.delete(payload.id);
    console.warn("[Plane Desktop] Notification failed:", error);
  });

  notification.show();
}

export function showDesktopNotification(
  payload: DesktopNotificationPayload,
  onClick?: (payload: DesktopNotificationPayload) => void
): void {
  if (process.platform === "win32") {
    showWindowsToast(payload, onClick);
    return;
  }

  showElectronNotification(payload, onClick);
}

export function updateMainWindowTitle(mainWindow: BrowserWindow | null, unreadCount: number): void {
  if (!mainWindow) {
    return;
  }

  mainWindow.setTitle(unreadCount > 0 ? `Plane (${unreadCount})` : "Plane");
}
