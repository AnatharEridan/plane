/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@plane/constants";
import { getButtonStyling } from "@plane/ui";
import { cn } from "@plane/utils";
import { EPageTypes } from "@/helpers/authentication.helper";
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import DefaultLayout from "@/layouts/default-layout";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";

type TIssueCodeResponse = {
  code?: string;
  redirect_uri?: string;
  error?: string;
  message?: string;
};

function DesktopAuthCompletePage() {
  const router = useAppRouter();
  const { data: currentUser, isLoading: isUserLoading } = useUser();
  const [status, setStatus] = useState<"loading" | "error" | "redirecting">("loading");
  const [message, setMessage] = useState("Connecting your desktop app...");

  useEffect(() => {
    if (isUserLoading) {
      return;
    }

    if (!currentUser?.id) {
      router.push("/?next_path=/desktop-auth/complete");
      return;
    }

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
          setMessage(data.message || "Could not complete desktop sign-in.");
          return;
        }

        setStatus("redirecting");
        setMessage("Returning to Plane desktop...");
        window.location.href = `${data.redirect_uri}?code=${encodeURIComponent(data.code)}`;
      } catch {
        setStatus("error");
        setMessage("Could not reach the Plane server.");
      }
    };

    void completeDesktopAuth();
  }, [currentUser?.id, isUserLoading, router]);

  return (
    <DefaultLayout>
      <div className="flex h-screen w-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-18 font-semibold text-primary">Plane Desktop</h1>
        <p className="mt-3 max-w-md text-13 text-secondary">{message}</p>
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
      </div>
    </DefaultLayout>
  );
}

export default function Page() {
  return (
    <AuthenticationWrapper pageType={EPageTypes.PUBLIC}>
      <DesktopAuthCompletePage />
    </AuthenticationWrapper>
  );
}
