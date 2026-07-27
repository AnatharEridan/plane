import http from "node:http";
import { shell } from "electron";
import { desktopConfig } from "./config";
import { getPlaneSession } from "./session-manager";

const AUTH_CALLBACK_PATH = "/callback";
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

type BrowserAuthResult = {
  success: boolean;
  error?: string;
};

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not resolve auth callback port."));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForAuthCode(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (!request.url?.startsWith(AUTH_CALLBACK_PATH)) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
      const code = requestUrl.searchParams.get("code");

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Plane Desktop</title></head>
  <body style="font-family:Segoe UI,sans-serif;text-align:center;padding:48px;">
    <h1>Signed in</h1>
    <p>You can close this tab and return to Plane Desktop.</p>
  </body>
</html>`);

      server.close();

      if (!code) {
        reject(new Error("Desktop auth callback did not include a code."));
        return;
      }

      resolve(code);
    });

    server.on("error", (error) => {
      server.close();
      reject(error);
    });

    server.listen(port, "127.0.0.1");

    setTimeout(() => {
      server.close();
      reject(new Error("Desktop sign-in timed out."));
    }, AUTH_TIMEOUT_MS);
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
    const port = await findAvailablePort();
    const redirectUri = `http://127.0.0.1:${port}${AUTH_CALLBACK_PATH}`;
    const authUrl = `${desktopConfig.apiBaseUrl}/auth/desktop/start/?redirect_uri=${encodeURIComponent(redirectUri)}`;

    const codePromise = waitForAuthCode(port);
    await shell.openExternal(authUrl);

    const code = await codePromise;
    await exchangeAuthCode(code, redirectUri);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Desktop browser sign-in failed.",
    };
  }
}
