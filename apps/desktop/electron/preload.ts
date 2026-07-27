import { contextBridge, ipcRenderer } from "electron";

export type DesktopNotificationPayload = {
  id: string;
  title: string;
  body: string;
  url?: string;
};

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  showNotification: (payload: DesktopNotificationPayload) => ipcRenderer.invoke("desktop:show-notification", payload),
  setUnreadCount: (count: number) => ipcRenderer.invoke("desktop:set-unread-count", count),
  startBrowserAuth: () => ipcRenderer.invoke("desktop:start-browser-auth"),
});

class DesktopNotificationPolyfill {
  readonly title: string;
  readonly body: string;
  readonly data: unknown;
  onclick: ((event: Event) => void) | null = null;
  onshow: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;

  static permission: NotificationPermission = "granted";

  static requestPermission = async (): Promise<NotificationPermission> => "granted";

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.body = options?.body ?? "";
    this.data = options?.data;

    void ipcRenderer.invoke("desktop:show-notification", {
      id: `web-notification-${Date.now()}`,
      title: this.title,
      body: this.body,
    });
  }

  close(): void {
    // Native notifications are dismissed by the OS.
  }

  addEventListener(): void {
    // Not implemented for MVP.
  }

  removeEventListener(): void {
    // Not implemented for MVP.
  }

  dispatchEvent(): boolean {
    return false;
  }
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: DesktopNotificationPolyfill,
  });
}
