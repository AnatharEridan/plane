/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/ui";
import { cn } from "@plane/utils";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { useAppRouter } from "@/hooks/use-app-router";
import DefaultLayout from "@/layouts/default-layout";

type TIssueCodeResponse = {
  code?: string;
  redirect_uri?: string;
  error?: string;
  message?: string;
};

function openDesktopCallback(callbackUrl: string): void {
  // Do not use <a href="plane://..."> or location.assign — that navigates this tab
  // and Chrome shows an error page (often reported as HTTP 502).
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = callbackUrl;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 2000);
}

async function fetchAuthenticatedUserId(): Promise<string | null> {
  const response = await fetch(`${API_BASE_URL}/api/users/me/`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as { id?: string };
  return user.id ?? null;
}

export default function DesktopAuthCompletePage() {
  const router = useAppRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Preparing desktop sign-in...");
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const hasStarted = useRef(false);

  const launchDesktop = useCallback((url: string) => {
    openDesktopCallback(url);
  }, []);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    const completeDesktopAuth = async () => {
      try {
        const userId = await fetchAuthenticatedUserId();

        if (!userId) {
          router.replace("/?next_path=/desktop-auth/complete");
          return;
        }

        const response = await fetch(`${API_BASE_URL}/auth/desktop/issue-code/`, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        let data: TIssueCodeResponse = {};
        try {
          data = (await response.json()) as TIssueCodeResponse;
        } catch {
          throw new Error("Invalid response from desktop sign-in endpoint.");
        }

        if (!response.ok || !data.code || !data.redirect_uri) {
          setStatus("error");
          setMessage(
            data.message ||
              "Could not complete desktop sign-in. Start sign-in from the Plane desktop app (Ctrl+Shift+B)."
          );
          return;
        }

        const nextCallbackUrl = `${data.redirect_uri}?code=${encodeURIComponent(data.code)}`;
        setCallbackUrl(nextCallbackUrl);
        setStatus("ready");
        setMessage("You're signed in. Click the button below to open Plane Desktop.");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not reach the Plane server.");
      }
    };

    void completeDesktopAuth();
  }, [router]);

  return (
    <DefaultLayout>
      <div className="flex h-screen w-full flex-col items-center justify-center px-6 text-center">
        {status === "loading" ? (
          <>
            <LogoSpinner />
            <p className="mt-4 text-13 text-secondary">{message}</p>
          </>
        ) : (
          <>
            <h1 className="text-18 font-semibold text-primary">Plane Desktop</h1>
            <p className="mt-3 max-w-md text-13 text-secondary">{message}</p>

            {status === "ready" && callbackUrl && (
              <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="base"
                  className={cn(getButtonStyling("primary", "base"), "w-full")}
                  onClick={() => launchDesktop(callbackUrl)}
                >
                  Open Plane Desktop
                </Button>
                <p className="text-11 text-tertiary">
                  If your browser asks for permission, choose Open or Allow. You can close this tab after Plane opens.
                </p>
              </div>
            )}

            {status === "error" && (
              <a
                href="/"
                className={cn(
                  getButtonStyling("primary", "base"),
                  "mt-6 inline-flex items-center justify-center px-4 py-2 no-underline"
                )}
              >
                Back to sign in
              </a>
            )}
          </>
        )}
      </div>
    </DefaultLayout>
  );
}
