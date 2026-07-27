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

type ExchangePayload = {
  session_key?: string;
  session_cookie_name?: string;
  session_cookie_domain?: string | null;
  expires_in?: number;
  error?: string;
  message?: string;
};

let pendingAuth: PendingAuthHandlers | null = null;
let queuedAuthCode: string | null = null;
let authFlowPromise: Promise<BrowserAuthResult> | null = null;

function parseAuthCallbackCode(url: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "plane:" || parsed.host !== "auth" || parsed.pathname !== "/callback") {
    return null;
  }

  return parsed.searchParams.get("code");
}

function clearPendingAuth(): void {
  if (!pendingAuth) {
    return;
  }

  clearTimeout(pendingAuth.timeoutId);
  pendingAuth = null;
}

export function handleAuthCallbackUrl(url: string): boolean {
  const code = parseAuthCallbackCode(url);
  if (!code) {
    return false;
  }

  if (pendingAuth) {
    pendingAuth.resolve(code);
    clearPendingAuth();
    return true;
  }

  queuedAuthCode = code;
  return true;
}

async function verifyDesktopSession(cookieName: string, cookieValue: string): Promise<boolean> {
  const response = await fetch(`${desktopConfig.apiBaseUrl}/api/users/me/`, {
    headers: {
      Accept: "application/json",
      Cookie: `${cookieName}=${cookieValue}`,
    },
  });

  return response.ok;
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

  const payload = (await response.json()) as ExchangePayload;

  if (!response.ok || !payload.session_key || !payload.session_cookie_name) {
    throw new Error(payload.message || payload.error || "Could not exchange desktop auth code.");
  }

  const expirationDate = Math.floor(Date.now() / 1000) + (payload.expires_in ?? 60 * 60 * 24 * 7);
  const cookieDetails: Electron.CookiesSetDetails = {
    url: desktopConfig.serverUrl,
    name: payload.session_cookie_name,
    value: payload.session_key,
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    expirationDate,
  };

  if (payload.session_cookie_domain) {
    cookieDetails.domain = payload.session_cookie_domain;
  }

  await getPlaneSession().cookies.set(cookieDetails);
  await getPlaneSession().cookies.flushStore();

  const sessionVerified = await verifyDesktopSession(payload.session_cookie_name, payload.session_key);
  if (!sessionVerified) {
    throw new Error("Desktop session was created but could not be verified.");
  }
}

async function completeAuthWithCode(code: string): Promise<void> {
  await exchangeAuthCode(code, DESKTOP_AUTH_REDIRECT_URI);
}

export async function completeAuthFromDeepLink(url: string): Promise<BrowserAuthResult> {
  const code = parseAuthCallbackCode(url);
  if (!code) {
    return { success: false, error: "Invalid desktop auth callback URL." };
  }

  if (authFlowPromise) {
    if (pendingAuth) {
      pendingAuth.resolve(code);
      clearPendingAuth();
    } else {
      queuedAuthCode = code;
    }
    return authFlowPromise;
  }

  if (pendingAuth) {
    pendingAuth.resolve(code);
    clearPendingAuth();
    return {
      success: false,
      error: "Desktop sign-in expired. Press Ctrl+Shift+B and try again.",
    };
  }

  authFlowPromise = (async () => {
    try {
      await completeAuthWithCode(code);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Desktop browser sign-in failed.",
      };
    } finally {
      authFlowPromise = null;
    }
  })();

  return authFlowPromise;
}

function waitForAuthCode(): Promise<string> {
  if (queuedAuthCode) {
    const code = queuedAuthCode;
    queuedAuthCode = null;
    return Promise.resolve(code);
  }

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

export async function startBrowserAuth(): Promise<BrowserAuthResult> {
  if (authFlowPromise) {
    return authFlowPromise;
  }

  authFlowPromise = (async () => {
    try {
      const redirectUri = DESKTOP_AUTH_REDIRECT_URI;
      const authUrl = `${desktopConfig.apiBaseUrl}/auth/desktop/start/?redirect_uri=${encodeURIComponent(redirectUri)}`;

      const codePromise = waitForAuthCode();
      await shell.openExternal(authUrl);

      const code = await codePromise;
      await completeAuthWithCode(code);

      return { success: true };
    } catch (error) {
      clearPendingAuth();

      return {
        success: false,
        error: error instanceof Error ? error.message : "Desktop browser sign-in failed.",
      };
    } finally {
      authFlowPromise = null;
    }
  })();

  return authFlowPromise;
}

export function getDeepLinkFromArgv(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith("plane://"));
}
