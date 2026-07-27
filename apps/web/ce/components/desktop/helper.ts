/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const isSidebarToggleVisible = () => true;

export const isDesktopApp = (): boolean =>
  typeof window !== "undefined" &&
  Boolean((window as Window & { electronAPI?: { isDesktop?: boolean } }).electronAPI?.isDesktop);
