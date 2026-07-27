/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Button, getButtonStyling } from "@plane/ui";
import { cn } from "@plane/utils";
import { isDesktopApp } from "./helper";

export function DesktopBrowserAuthButton() {
  if (!isDesktopApp()) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-subtle bg-layer-1 p-4">
      <div>
        <p className="text-13 font-medium text-primary">Sign in with your browser</p>
        <p className="mt-1 text-11 text-secondary">
          Use Google, password, or an existing browser session. You&apos;ll return here automatically.
        </p>
      </div>
      <Button
        type="button"
        variant="primary"
        size="base"
        className={cn(getButtonStyling("primary", "base"), "w-full")}
        onClick={() => {
          void window.electronAPI?.startBrowserAuth?.();
        }}
      >
        Continue in browser
      </Button>
    </div>
  );
}
