/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

const DESKTOP_UPDATE_FEED_PATH = "/desktop/updates/";

export const DESKTOP_LATEST_RELEASE_METADATA_PATH = `${DESKTOP_UPDATE_FEED_PATH}latest.yml`;

export function getLatestWindowsInstallerPath(metadata: string): string | null {
  const candidates = metadata
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:-\s*)?(?:url|path):\s*(.+?)\s*$/i)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) =>
      value
        .replace(/\s+#.*$/, "")
        .trim()
        .replace(/^(['"])(.*)\1$/, "$2")
    );

  return candidates.find((value) => /\.exe(?:[?#].*)?$/i.test(value)) ?? null;
}

export function resolveLatestWindowsInstallerUrl(metadata: string, origin: string): string {
  const installerPath = getLatestWindowsInstallerPath(metadata);
  if (!installerPath) {
    throw new Error("latest.yml does not contain a Windows installer");
  }

  const updateFeedUrl = new URL(DESKTOP_UPDATE_FEED_PATH, origin);
  const installerUrl = new URL(installerPath, updateFeedUrl);

  const isTrustedInstaller =
    installerUrl.origin === updateFeedUrl.origin &&
    installerUrl.pathname.startsWith(updateFeedUrl.pathname) &&
    installerUrl.protocol === updateFeedUrl.protocol &&
    /\.exe$/i.test(installerUrl.pathname);

  if (!isTrustedInstaller) {
    throw new Error("latest.yml points outside the trusted desktop update feed");
  }

  return installerUrl.toString();
}
