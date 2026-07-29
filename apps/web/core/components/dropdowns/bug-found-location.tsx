/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { MapPin } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CustomSelect } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useProject } from "@/hooks/store/use-project";

type Props = {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  variant?: "modal" | "sidebar";
};

export const BugFoundLocationDropdown = observer(function BugFoundLocationDropdown(props: Props) {
  const { projectId, value, onChange, disabled = false, variant = "sidebar" } = props;
  const { t } = useTranslation();
  const { getProjectById } = useProject();

  const configuredLocations = getProjectById(projectId)?.bug_found_locations ?? [];
  const locations =
    value && !configuredLocations.includes(value) ? [value, ...configuredLocations] : configuredLocations;

  return (
    <CustomSelect
      value={value}
      onChange={(selectedValue: string | null) => onChange(String(selectedValue ?? ""))}
      disabled={disabled}
      className={cn("w-full", {
        "h-7": variant === "modal",
        "h-7.5 grow": variant === "sidebar",
      })}
      buttonClassName={cn("h-full min-w-0 text-left", {
        "rounded-sm border-[0.5px] border-strong px-2 py-0.5 text-caption-sm-regular": variant === "modal",
        "border-0 bg-transparent px-2 py-0.5 text-body-xs-medium": variant === "sidebar",
      })}
      label={
        <div className="flex min-w-0 items-center gap-1.5">
          {variant === "modal" && <MapPin className="size-3.5 shrink-0" />}
          <span className={cn("truncate", { "text-placeholder": !value })}>
            {value || t("bug_tracking.location.placeholder")}
          </span>
        </div>
      }
      optionsClassName="z-30"
    >
      <CustomSelect.Option value="">
        <span className="text-placeholder">{t("common.none")}</span>
      </CustomSelect.Option>
      {locations.map((location) => (
        <CustomSelect.Option key={location} value={location}>
          <span className="max-w-64 truncate">{location}</span>
        </CustomSelect.Option>
      ))}
      {configuredLocations.length === 0 && !value && (
        <div className="px-1 py-1.5 text-placeholder">{t("bug_tracking.location.no_options")}</div>
      )}
    </CustomSelect>
  );
});
