/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IProject } from "@plane/types";
import { Input } from "@plane/ui";
// hooks
import { useProject } from "@/hooks/store/use-project";

type Props = {
  project: IProject;
  workspaceSlug: string;
  isAdmin: boolean;
};

type TLocationInput = {
  id: string;
  value: string;
};

const buildLocationInputs = (projectId: string, locations: string[]): TLocationInput[] =>
  locations.map((value, index) => ({ id: `${projectId}-${index}-${value}`, value }));

export function BugFoundLocationsSettings(props: Props) {
  const { project, workspaceSlug, isAdmin } = props;
  const { t } = useTranslation();
  const { updateProject } = useProject();
  const [locationInputs, setLocationInputs] = useState<TLocationInput[]>(() =>
    buildLocationInputs(project.id, project.bug_found_locations ?? [])
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocationInputs(buildLocationInputs(project.id, project.bug_found_locations ?? []));
  }, [project.bug_found_locations, project.id]);

  const updateLocation = (id: string, value: string) => {
    setLocationInputs((currentInputs) =>
      currentInputs.map((currentInput) => (currentInput.id === id ? { ...currentInput, value } : currentInput))
    );
  };

  const removeLocation = (id: string) => {
    setLocationInputs((currentInputs) => currentInputs.filter((currentInput) => currentInput.id !== id));
  };

  const saveLocations = async () => {
    const normalizedLocations = locationInputs.map((location) => location.value.trim());
    const hasEmptyLocation = normalizedLocations.some((location) => !location);
    const uniqueLocations = new Set(normalizedLocations.map((location) => location.toLocaleLowerCase()));

    if (hasEmptyLocation || uniqueLocations.size !== normalizedLocations.length) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: hasEmptyLocation
          ? t("bug_tracking.settings.validation.empty")
          : t("bug_tracking.settings.validation.duplicate"),
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateProject(workspaceSlug, project.id, { bug_found_locations: normalizedLocations });
      setLocationInputs(buildLocationInputs(project.id, normalizedLocations));
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("toast.success"),
        message: t("bug_tracking.settings.toast.success"),
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: t("bug_tracking.settings.toast.error"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty =
    JSON.stringify(locationInputs.map((location) => location.value)) !==
    JSON.stringify(project.bug_found_locations ?? []);

  return (
    <section className="mt-10 border-t border-subtle pt-8">
      <div className="flex flex-col gap-1">
        <h3 className="text-body-sm-medium text-primary">{t("bug_tracking.settings.title")}</h3>
        <p className="text-caption-md-regular text-tertiary">{t("bug_tracking.settings.description")}</p>
      </div>
      <div className="mt-5 rounded-lg border border-subtle bg-layer-2 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-body-xs-medium text-primary">{t("bug_tracking.settings.locations.title")}</h4>
            <p className="mt-1 text-caption-sm-regular text-tertiary">
              {t("bug_tracking.settings.locations.description")}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setLocationInputs((currentInputs) => [
                ...currentInputs,
                { id: globalThis.crypto.randomUUID(), value: "" },
              ])
            }
            disabled={!isAdmin}
          >
            <Plus className="size-3.5" />
            {t("bug_tracking.settings.locations.add")}
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {locationInputs.length === 0 ? (
            <p className="rounded-md border border-dashed border-subtle px-3 py-4 text-center text-caption-sm-regular text-placeholder">
              {t("bug_tracking.settings.locations.empty")}
            </p>
          ) : (
            locationInputs.map((location) => (
              <div key={location.id} className="flex items-center gap-2">
                <Input
                  value={location.value}
                  onChange={(event) => updateLocation(location.id, event.target.value)}
                  maxLength={255}
                  placeholder={t("bug_tracking.settings.locations.placeholder")}
                  disabled={!isAdmin}
                  className="w-full"
                />
                <button
                  type="button"
                  onClick={() => removeLocation(location.id)}
                  disabled={!isAdmin}
                  className="grid size-9 shrink-0 place-items-center rounded-md text-tertiary hover:bg-layer-1 hover:text-danger-primary disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("common.remove")}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
        {isAdmin && (
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={saveLocations} loading={isSaving} disabled={!isDirty || isSaving}>
              {t("common.save_changes")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
