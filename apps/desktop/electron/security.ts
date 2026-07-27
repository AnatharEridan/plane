import { shell } from "electron";
import type { WebContents } from "electron";
import { desktopConfig } from "./config";

function isAllowedHost(hostname: string): boolean {
  return desktopConfig.allowedHosts.some(
    (allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
  );
}

export function isAllowedNavigationUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);

    if (url.protocol === "file:") {
      return true;
    }

    if (url.protocol === "http:" || url.protocol === "https:") {
      return isAllowedHost(url.hostname);
    }

    return false;
  } catch {
    return false;
  }
}

export function attachNavigationSecurity(webContents: WebContents): void {
  webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigationUrl(url)) {
      return { action: "allow" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigationUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
}

export function attachCertificatePolicy(): void {
  if (desktopConfig.allowInsecureCert) {
    return;
  }

  // Default Electron certificate validation applies.
}
