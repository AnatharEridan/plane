/**
 * Injected into the Plane web page to poll unread notifications and forward them
 * to the Electron main process via preload bridge.
 */
export function getNotificationWatcherScript(pollIntervalMs: number, apiBaseUrl: string): string {
  return `
(function () {
  if (window.__planeDesktopNotificationWatcher) return;
  window.__planeDesktopNotificationWatcher = true;

  var POLL_INTERVAL_MS = ${pollIntervalMs};
  var API_BASE_URL = ${JSON.stringify(apiBaseUrl)};
  var RESERVED_PATHS = new Set([
    "login",
    "sign-in",
    "sign-up",
    "register",
    "accounts",
    "invitations",
    "onboarding",
    "create-workspace",
    "god-mode",
    "spaces",
    "live",
    "api",
    "auth",
    "static",
  ]);

  var state = {
    workspaceSlug: null,
    lastUnreadCount: 0,
    seenNotificationIds: new Set(),
    initialized: false,
  };

  function getWorkspaceSlug() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    var slug = parts[0];
    if (!slug || RESERVED_PATHS.has(slug)) return null;
    return slug;
  }

  function stripHtml(value) {
    if (!value) return "";
    var element = document.createElement("div");
    element.innerHTML = value;
    return (element.textContent || element.innerText || "").trim();
  }

  function getNotificationBody(notification) {
    if (notification.message_html) {
      return stripHtml(notification.message_html);
    }
    if (notification.data && notification.data.issue && notification.data.issue.name) {
      return notification.data.issue.name;
    }
    return "You have a new notification";
  }

  function getNotificationUrl(notification, workspaceSlug) {
    if (notification.data && notification.data.issue && notification.data.issue.identifier) {
      return window.location.origin + "/" + workspaceSlug + "/browse/" + notification.data.issue.identifier;
    }
    return window.location.origin + "/" + workspaceSlug + "/notifications";
  }

  async function fetchUnreadCount(workspaceSlug) {
    var response = await fetch(
      API_BASE_URL + "/api/workspaces/" + encodeURIComponent(workspaceSlug) + "/users/notifications/unread/",
      { credentials: "include", headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  async function fetchLatestNotifications(workspaceSlug) {
    var params = new URLSearchParams({
      per_page: "10",
      read: "false",
    });

    var response = await fetch(
      API_BASE_URL + "/api/workspaces/" + encodeURIComponent(workspaceSlug) + "/users/notifications?" + params.toString(),
      { credentials: "include", headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      return [];
    }

    var data = await response.json();
    return Array.isArray(data.results) ? data.results : [];
  }

  async function notifyNewItems(workspaceSlug, unreadCount) {
    if (!window.electronAPI || typeof window.electronAPI.showNotification !== "function") {
      return;
    }

    window.electronAPI.setUnreadCount(unreadCount);

    if (!state.initialized) {
      if (unreadCount > 0) {
        var existingNotifications = await fetchLatestNotifications(workspaceSlug);
        for (var i = 0; i < existingNotifications.length; i++) {
          var existing = existingNotifications[i];
          if (existing && existing.id) {
            state.seenNotificationIds.add(existing.id);
          }
        }
      }

      state.initialized = true;
      state.lastUnreadCount = unreadCount;
      return;
    }

    if (unreadCount <= state.lastUnreadCount) {
      state.lastUnreadCount = unreadCount;
      return;
    }

    var notifications = await fetchLatestNotifications(workspaceSlug);

    for (var i = notifications.length - 1; i >= 0; i--) {
      var notification = notifications[i];
      if (!notification || !notification.id || state.seenNotificationIds.has(notification.id)) {
        continue;
      }

      state.seenNotificationIds.add(notification.id);

      window.electronAPI.showNotification({
        id: notification.id,
        title: notification.title || "Plane",
        body: getNotificationBody(notification),
        url: getNotificationUrl(notification, workspaceSlug),
      });
    }

    state.lastUnreadCount = unreadCount;
  }

  async function pollNotifications() {
    if (!window.electronAPI || !window.electronAPI.isDesktop) {
      return;
    }

    var workspaceSlug = getWorkspaceSlug();
    if (!workspaceSlug) {
      state.workspaceSlug = null;
      state.initialized = false;
      state.lastUnreadCount = 0;
      return;
    }

    if (state.workspaceSlug !== workspaceSlug) {
      state.workspaceSlug = workspaceSlug;
      state.initialized = false;
      state.lastUnreadCount = 0;
      state.seenNotificationIds.clear();
    }

    try {
      var unread = await fetchUnreadCount(workspaceSlug);
      if (!unread) return;

      var unreadCount = unread.total_unread_notifications_count || 0;
      await notifyNewItems(workspaceSlug, unreadCount);
    } catch (error) {
      console.warn("[Plane Desktop] Notification poll failed", error);
    }
  }

  window.addEventListener("load", function () {
    setTimeout(pollNotifications, 3000);
    setInterval(pollNotifications, POLL_INTERVAL_MS);
  });

  var originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(history, arguments);
    setTimeout(pollNotifications, 1000);
  };

  var originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(history, arguments);
    setTimeout(pollNotifications, 1000);
  };

  window.addEventListener("popstate", function () {
    setTimeout(pollNotifications, 1000);
  });
})();
`;
}
