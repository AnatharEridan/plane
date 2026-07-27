/**
 * Injected into the Plane web page to poll unread notifications and forward them
 * to the Electron main process via preload bridge.
 */
export function getNotificationWatcherScript(pollIntervalMs: number, apiBaseUrl: string): string {
  return `
(function () {
  if (window.__planeDesktopNotificationWatcher) {
    if (typeof window.__planeDesktopPollNow === "function") {
      window.__planeDesktopPollNow();
    }
    return;
  }
  window.__planeDesktopNotificationWatcher = true;

  var POLL_INTERVAL_MS = ${pollIntervalMs};
  var API_BASE_URL = ${JSON.stringify(apiBaseUrl)};

  var state = {
    workspaceStates: new Map(),
    seenNotificationIds: new Set(),
    pollTimerId: null,
  };

  function getWorkspaceState(slug) {
    if (!state.workspaceStates.has(slug)) {
      state.workspaceStates.set(slug, {
        initialized: false,
        lastUnreadCount: 0,
      });
    }
    return state.workspaceStates.get(slug);
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

  async function fetchUserWorkspaces() {
    var response = await fetch(API_BASE_URL + "/api/users/me/workspaces/", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    var data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map(function (workspace) {
        return workspace && workspace.slug ? workspace.slug : null;
      })
      .filter(Boolean);
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

  function getTotalUnreadCount(unread) {
    return (
      (unread.total_unread_notifications_count || 0) +
      (unread.mention_unread_notifications_count || 0)
    );
  }

  async function notifyNewItems(workspaceSlug, unreadCount) {
    if (!window.electronAPI || typeof window.electronAPI.showNotification !== "function") {
      return;
    }

    var workspaceState = getWorkspaceState(workspaceSlug);

    if (!workspaceState.initialized) {
      if (unreadCount > 0) {
        var existingNotifications = await fetchLatestNotifications(workspaceSlug);
        for (var i = 0; i < existingNotifications.length; i++) {
          var existing = existingNotifications[i];
          if (existing && existing.id) {
            state.seenNotificationIds.add(existing.id);
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

    var notifications = await fetchLatestNotifications(workspaceSlug);

    for (var j = notifications.length - 1; j >= 0; j--) {
      var notification = notifications[j];
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

    workspaceState.lastUnreadCount = unreadCount;
  }

  async function pollNotifications() {
    if (!window.electronAPI || !window.electronAPI.isDesktop) {
      return;
    }

    try {
      var workspaceSlugs = await fetchUserWorkspaces();
      if (!workspaceSlugs.length) {
        return;
      }

      var totalUnread = 0;

      for (var i = 0; i < workspaceSlugs.length; i++) {
        var workspaceSlug = workspaceSlugs[i];
        var unread = await fetchUnreadCount(workspaceSlug);
        if (!unread) {
          continue;
        }

        var unreadCount = getTotalUnreadCount(unread);
        totalUnread += unreadCount;
        await notifyNewItems(workspaceSlug, unreadCount);
      }

      if (typeof window.electronAPI.setUnreadCount === "function") {
        window.electronAPI.setUnreadCount(totalUnread);
      }
    } catch (error) {
      console.warn("[Plane Desktop] Notification poll failed", error);
    }
  }

  window.__planeDesktopPollNow = pollNotifications;

  setTimeout(pollNotifications, 2000);
  state.pollTimerId = window.setInterval(pollNotifications, POLL_INTERVAL_MS);

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
