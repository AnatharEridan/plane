declare global {
  interface Window {
    electronAPI?: {
      isDesktop: boolean;
      showNotification: (payload: { id: string; title: string; body: string; url?: string }) => Promise<void>;
      setUnreadCount: (count: number) => Promise<void>;
      startBrowserAuth: () => Promise<{ success: boolean; error?: string }>;
    };
    __planeDesktopNotificationWatcher?: boolean;
  }
}
