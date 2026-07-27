import { desktopConfig } from "./config";
import { getPlaneSession } from "./session-manager";
import { showDesktopNotification, updateMainWindowTitle, type DesktopNotificationPayload } from "./notifications";
import type { BrowserWindow } from "electron";

type WorkspacePollState = {
  initialized: boolean;
  lastUnreadCount: number;
};

type NotificationRecord = {
  id: string;
  title?: string;
  message_html?: string;
  data?: {
    issue?: {
      name?: string;
      identifier?: string;
    };
  };
};

type UnreadCountResponse = {
  total_unread_notifications_count?: number;
  mention_unread_notifications_count?: number;
};

type WorkspaceSummary = {
  slug?: string;
};

type NotificationListResponse = {
  results?: NotificationRecord[];
};

const seenNotificationIds = new Set<string>();
const workspaceStates = new Map<string, WorkspacePollState>();

let pollTimer: NodeJS.Timeout | null = null;
let onNotificationClick: ((url?: string) => void) | null = null;
let getMainWindow: (() => BrowserWindow | null) | null = null;

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNotificationBody(notification: NotificationRecord): string {
  if (notification.message_html) {
    return stripHtml(notification.message_html);
  }

  if (notification.data?.issue?.name) {
    return notification.data.issue.name;
  }

  return "You have a new notification";
}

function getNotificationUrl(notification: NotificationRecord, workspaceSlug: string): string {
  const identifier = notification.data?.issue?.identifier;
  if (identifier) {
    return `${desktopConfig.serverOrigin}/${workspaceSlug}/browse/${identifier}`;
  }

  return `${desktopConfig.serverOrigin}/${workspaceSlug}/notifications`;
}

async function sessionFetch(pathname: string, init?: RequestInit): Promise<Response> {
  const url = `${desktopConfig.apiBaseUrl}${pathname}`;
  const cookies = await getPlaneSession().cookies.get({ url: desktopConfig.serverUrl });
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });
}

async function fetchUserWorkspaces(): Promise<string[]> {
  const response = await sessionFetch("/api/users/me/workspaces/");
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as WorkspaceSummary[];
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((workspace) => workspace.slug).filter((slug): slug is string => Boolean(slug));
}

async function fetchUnreadCount(workspaceSlug: string): Promise<number | null> {
  const response = await sessionFetch(
    `/api/workspaces/${encodeURIComponent(workspaceSlug)}/users/notifications/unread/`
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as UnreadCountResponse;
  return (data.total_unread_notifications_count ?? 0) + (data.mention_unread_notifications_count ?? 0);
}

async function fetchLatestNotifications(workspaceSlug: string): Promise<NotificationRecord[]> {
  const params = new URLSearchParams({
    per_page: "10",
    read: "false",
  });

  const response = await sessionFetch(
    `/api/workspaces/${encodeURIComponent(workspaceSlug)}/users/notifications?${params.toString()}`
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as NotificationListResponse;
  return Array.isArray(data.results) ? data.results : [];
}

function getWorkspaceState(workspaceSlug: string): WorkspacePollState {
  const existing = workspaceStates.get(workspaceSlug);
  if (existing) {
    return existing;
  }

  const nextState: WorkspacePollState = {
    initialized: false,
    lastUnreadCount: 0,
  };
  workspaceStates.set(workspaceSlug, nextState);
  return nextState;
}

async function notifyNewItems(workspaceSlug: string, unreadCount: number): Promise<void> {
  const workspaceState = getWorkspaceState(workspaceSlug);

  if (!workspaceState.initialized) {
    if (unreadCount > 0) {
      const existingNotifications = await fetchLatestNotifications(workspaceSlug);
      for (const notification of existingNotifications) {
        if (notification.id) {
          seenNotificationIds.add(notification.id);
        }
      }
    }

    workspaceState.initialized = true;
    workspaceState.lastUnreadCount = unreadCount;
    return;
  }

  if (unreadCount <= workspaceState.lastUnreadCount) {
    workspaceState.lastUnreadCount = unreadCount;
    return;
  }

  const notifications = await fetchLatestNotifications(workspaceSlug);

  for (const notification of notifications.toReversed()) {
    if (!notification.id || seenNotificationIds.has(notification.id)) {
      continue;
    }

    seenNotificationIds.add(notification.id);

    const payload: DesktopNotificationPayload = {
      id: notification.id,
      title: notification.title || "Plane",
      body: getNotificationBody(notification),
      url: getNotificationUrl(notification, workspaceSlug),
    };

    showDesktopNotification(payload, (clickedPayload) => {
      onNotificationClick?.(clickedPayload.url);
    });
  }

  workspaceState.lastUnreadCount = unreadCount;
}

export async function pollDesktopNotifications(): Promise<void> {
  try {
    const workspaceSlugs = await fetchUserWorkspaces();
    if (!workspaceSlugs.length) {
      return;
    }

    const entries = await Promise.all(
      workspaceSlugs.map(async (workspaceSlug) => ({
        workspaceSlug,
        unreadCount: await fetchUnreadCount(workspaceSlug),
      }))
    );

    let totalUnread = 0;
    const notifyTasks: Promise<void>[] = [];

    for (const entry of entries) {
      if (entry.unreadCount === null) {
        continue;
      }

      totalUnread += entry.unreadCount;
      notifyTasks.push(notifyNewItems(entry.workspaceSlug, entry.unreadCount));
    }

    await Promise.all(notifyTasks);

    updateMainWindowTitle(getMainWindow?.() ?? null, totalUnread);
  } catch (error) {
    console.warn("[Plane Desktop] Notification poll failed", error);
  }
}

export function startDesktopNotificationPoller(
  intervalMs: number,
  handleNotificationClick: (url?: string) => void,
  resolveMainWindow: () => BrowserWindow | null
): void {
  onNotificationClick = handleNotificationClick;
  getMainWindow = resolveMainWindow;

  if (pollTimer) {
    clearInterval(pollTimer);
  }

  setTimeout(() => {
    void pollDesktopNotifications();
  }, 3000);

  pollTimer = setInterval(() => {
    void pollDesktopNotifications();
  }, intervalMs);
}

export function stopDesktopNotificationPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
