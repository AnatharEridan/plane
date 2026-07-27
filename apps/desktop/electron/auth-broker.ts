import { shell } from "electron";
import { desktopConfig } from "./config";
import { getPlaneSession } from "./session-manager";

export const DESKTOP_AUTH_REDIRECT_URI = "plane://auth/callback";
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

type BrowserAuthResult = {
  success: boolean;
  error?: string;
};

type PendingAuthHandlers = {
  resolve: (code: string) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
};

let pendingAuth: PendingAuthHandlers | null = null;

function clearPendingAuth(): void {
  if (!pendingAuth) {
    return;
  }

  clearTimeout(pendingAuth.timeoutId);
  pendingAuth = null;
}

export function handleAuthCallbackUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "plane:" || parsed.host !== "auth" || parsed.pathname !== "/callback") {
    return false;
  }

  const code = parsed.searchParams.get("code");
  if (!code) {
    return false;
  }

  if (!pendingAuth) {
    return true;
  }

  pendingAuth.resolve(code);
  clearPendingAuth();
  return true;
}

function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    clearPendingAuth();

    const timeoutId = setTimeout(() => {
      if (pendingAuth) {
        pendingAuth = null;
        reject(new Error("Desktop sign-in timed out."));
      }
    }, AUTH_TIMEOUT_MS);

    pendingAuth = { resolve, reject, timeoutId };
  });
}

async function exchangeAuthCode(code: string, redirectUri: string): Promise<void> {
  const response = await fetch(`${desktopConfig.apiBaseUrl}/auth/desktop/exchange/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });

  const payload = (await response.json()) as {
    session_key?: string;
    session_cookie_name?: string;
    expires_in?: number;
    error?: string;
    message?: string;
  };

  if (!response.ok || !payload.session_key || !payload.session_cookie_name) {
    throw new Error(payload.message || payload.error || "Could not exchange desktop auth code.");
  }

  const expirationDate = Math.floor(Date.now() / 1000) + (payload.expires_in ?? 60 * 60 * 24 * 7);

  await getPlaneSession().cookies.set({
    url: desktopConfig.serverUrl,
    name: payload.session_cookie_name,
    value: payload.session_key,
    domain: desktopConfig.serverHostname,
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    expirationDate,
  });

  await getPlaneSession().cookies.flushStore();
}

export async function startBrowserAuth(): Promise<BrowserAuthResult> {
  try {
    const redirectUri = DESKTOP_AUTH_REDIRECT_URI;
    const authUrl = `${desktopConfig.apiBaseUrl}/auth/desktop/start/?redirect_uri=${encodeURIComponent(redirectUri)}`;

    const codePromise = waitForAuthCode();
    await shell.openExternal(authUrl);

    const code = await codePromise;
    await exchangeAuthCode(code, redirectUri);

    return { success: true };
  } catch (error) {
    clearPendingAuth();

    return {
      success: false,
      error: error instanceof Error ? error.message : "Desktop browser sign-in failed.",
    };
  }
}

export function getDeepLinkFromArgv(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith("plane://"));
}
