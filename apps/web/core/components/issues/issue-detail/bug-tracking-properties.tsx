/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { MapPin, Tag } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TIssue } from "@plane/types";
import { Input } from "@plane/ui";
// components
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { BugFoundLocationDropdown } from "@/components/dropdowns/bug-found-location";

type TBugTrackingFields = Pick<TIssue, "bug_found_location" | "affected_version">;

type Props = {
  issue: TIssue;
  disabled: boolean;
  textClassName?: string;
  onUpdate: (data: Partial<TBugTrackingFields>) => Promise<void> | void;
};

export function BugTrackingIssueProperties(props: Props) {
  const { issue, disabled, textClassName = "text-body-xs-medium", onUpdate } = props;
  const { t } = useTranslation();
  const [version, setVersion] = useState(issue.affected_version);

  useEffect(() => {
    setVersion(issue.affected_version);
  }, [issue.affected_version]);

  const commitVersion = () => {
    const normalizedVersion = version.trim();
    setVersion(normalizedVersion);
    if (normalizedVersion !== issue.affected_version) void onUpdate({ affected_version: normalizedVersion });
  };

  return (
    <>
      <SidebarPropertyListItem icon={MapPin} label={t("bug_tracking.location.label")}>
        <BugFoundLocationDropdown
          projectId={issue.project_id ?? ""}
          value={issue.bug_found_location}
          onChange={(bugFoundLocation) => void onUpdate({ bug_found_location: bugFoundLocation })}
          disabled={disabled}
        />
      </SidebarPropertyListItem>
      <SidebarPropertyListItem icon={Tag} label={t("bug_tracking.version.label")}>
        <Input
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          onBlur={commitVersion}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          maxLength={255}
          disabled={disabled}
          mode="transparent"
          inputSize="xs"
          className={`h-7.5 w-full ${textClassName}`}
          placeholder={t("bug_tracking.version.placeholder")}
        />
      </SidebarPropertyListItem>
    </>
  );
}
