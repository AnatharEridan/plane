/**
 * Injects a browser sign-in button on auth pages with retries for SPA hydration.
 */
export function getBrowserAuthButtonScript(): string {
  return `
(function () {
  if (window.__planeDesktopBrowserAuthMount) return;
  window.__planeDesktopBrowserAuthMount = true;

  function isAuthLikePage() {
    var path = window.location.pathname || "/";
    return (
      path === "/" ||
      path === "/sign-in" ||
      path === "/sign-up" ||
      path.indexOf("/accounts/") === 0
    );
  }

  function mountBrowserAuthButton() {
    if (!window.electronAPI || typeof window.electronAPI.startBrowserAuth !== "function") {
      return;
    }

    if (!isAuthLikePage()) {
      var existing = document.getElementById("plane-desktop-browser-auth");
      if (existing) existing.remove();
      return;
    }

    if (document.getElementById("plane-desktop-browser-auth")) return;
    if (!document.body) return;

    var container = document.createElement("div");
    container.id = "plane-desktop-browser-auth";
    container.style.position = "fixed";
    container.style.right = "24px";
    container.style.bottom = "24px";
    container.style.zIndex = "2147483647";
    container.style.maxWidth = "320px";
    container.style.padding = "16px";
    container.style.borderRadius = "12px";
    container.style.background = "#151617";
    container.style.border = "1px solid #2a2b2d";
    container.style.boxShadow = "0 12px 32px rgba(0,0,0,0.35)";
    container.style.fontFamily = "Inter, Segoe UI, sans-serif";
    container.style.pointerEvents = "auto";

    container.innerHTML =
      '<p style="margin:0 0 8px;color:#ececed;font-size:14px;font-weight:600;">Войти через браузер</p>' +
      '<p style="margin:0 0 12px;color:#a8a8a8;font-size:12px;line-height:1.4;">Откроется Chrome/Edge. Можно Google, пароль или уже активную сессию.</p>' +
      '<button id="plane-desktop-browser-auth-button" type="button" style="width:100%;border:0;border-radius:8px;padding:10px 12px;background:#3b82f6;color:white;font-size:13px;cursor:pointer;">Continue in browser</button>' +
      '<p style="margin:10px 0 0;color:#737373;font-size:11px;line-height:1.3;">Горячая клавиша: Ctrl+Shift+B</p>';

    document.body.appendChild(container);

    document.getElementById("plane-desktop-browser-auth-button").addEventListener("click", function () {
      void window.electronAPI.startBrowserAuth();
    });
  }

  mountBrowserAuthButton();
  setInterval(mountBrowserAuthButton, 1500);

  var originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(history, arguments);
    setTimeout(mountBrowserAuthButton, 300);
  };

  var originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(history, arguments);
    setTimeout(mountBrowserAuthButton, 300);
  };

  window.addEventListener("popstate", function () {
    setTimeout(mountBrowserAuthButton, 300);
  });
})();
`;
}
