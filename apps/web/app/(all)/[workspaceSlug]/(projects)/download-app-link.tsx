/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// helpers
import {
  DESKTOP_LATEST_RELEASE_METADATA_PATH,
  resolveLatestWindowsInstallerUrl,
} from "@/plane-web/components/desktop/latest-release";

export function DownloadDesktopAppLink() {
  // plane hooks
  const { t } = useTranslation();
  // states
  const [isResolving, setIsResolving] = useState(false);

  const handleDownload = async () => {
    if (isResolving) return;

    setIsResolving(true);

    try {
      const response = await fetch(DESKTOP_LATEST_RELEASE_METADATA_PATH, {
        cache: "no-store",
        headers: {
          Accept: "text/yaml, text/plain",
        },
      });

      if (!response.ok) {
        throw new Error(`Latest release metadata returned ${response.status}`);
      }

      const installerUrl = resolveLatestWindowsInstallerUrl(await response.text(), window.location.origin);
      const installerFileName = decodeURIComponent(
        new URL(installerUrl).pathname.split("/").at(-1) ?? "Plane-Setup.exe"
      );
      const downloadLink = document.createElement("a");

      downloadLink.href = installerUrl;
      downloadLink.download = installerFileName;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (error) {
      console.error("Failed to resolve the latest Plane Desktop installer", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("home.desktop_app.download"),
        message: t("home.desktop_app.download_error"),
      });
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={t("home.desktop_app.download")}
      aria-busy={isResolving}
      className="flex flex-shrink-0 items-center gap-1.5 rounded-sm border border-subtle bg-layer-2 px-3 py-1.5 text-secondary transition-colors hover:bg-layer-2-hover hover:text-primary disabled:cursor-wait disabled:opacity-70"
      disabled={isResolving}
      onClick={handleDownload}
    >
      {isResolving ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      <span className="hidden text-11 font-medium sm:hidden md:block">
        {isResolving ? t("home.desktop_app.resolving") : t("home.desktop_app.download")}
      </span>
    </button>
  );
}
