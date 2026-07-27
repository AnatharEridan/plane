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
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import DefaultLayout from "@/layouts/default-layout";

type TIssueCodeResponse = {
  code?: string;
  redirect_uri?: string;
  error?: string;
  message?: string;
};

function openDesktopCallback(callbackUrl: string): void {
  const link = document.createElement("a");
  link.href = callbackUrl;
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function DesktopAuthCompletePage() {
  const router = useAppRouter();
  const { data: currentUser, isLoading: isUserLoading, fetchCurrentUser } = useUser();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Connecting your desktop app...");
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const hasRequestedCode = useRef(false);

  const launchDesktop = useCallback((url: string) => {
    openDesktopCallback(url);
  }, []);

  useEffect(() => {
    void fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (isUserLoading) {
      return;
    }

    if (!currentUser?.id) {
      router.replace("/?next_path=/desktop-auth/complete");
      return;
    }

    if (hasRequestedCode.current) {
      return;
    }

    hasRequestedCode.current = true;

    const completeDesktopAuth = async () => {
      try {
        const csrfResponse = await fetch(`${API_BASE_URL}/auth/get-csrf-token/`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const csrfData = (await csrfResponse.json()) as { csrf_token?: string };
        const csrfToken = csrfData.csrf_token;

        const response = await fetch(`${API_BASE_URL}/auth/desktop/issue-code/`, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
          },
        });

        const data = (await response.json()) as TIssueCodeResponse;

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
        setMessage("Sign-in successful. Open Plane Desktop to finish.");

        window.setTimeout(() => {
          launchDesktop(nextCallbackUrl);
        }, 400);
      } catch {
        setStatus("error");
        setMessage("Could not reach the Plane server.");
      }
    };

    void completeDesktopAuth();
  }, [currentUser?.id, isUserLoading, launchDesktop, router]);

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
                  "mt-6 inline-flex items-center justify-center px-4 py-2"
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
