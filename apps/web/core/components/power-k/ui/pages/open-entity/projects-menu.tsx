/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// plane types
import type { IPartialProject } from "@plane/types";
import { Spinner } from "@plane/ui";
// components
import { PowerKProjectsMenu } from "@/components/power-k/menus/projects";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";

type Props = {
  handleSelect: (project: IPartialProject) => void;
};

export const PowerKOpenProjectMenu = observer(function PowerKOpenProjectMenu(props: Props) {
  const { handleSelect } = props;
  // store hooks
  const { loader, joinedProjectIds, allWorkspaceProjectIds, getPartialProjectById } = useProject();
  const { allowPermissions } = useUserPermissions();
  const canSeeAllWorkspaceProjects = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );
  const visibleProjectIds = canSeeAllWorkspaceProjects ? allWorkspaceProjectIds : joinedProjectIds;
  // derived values
  const projectsList = visibleProjectIds
    ? visibleProjectIds.map((id) => getPartialProjectById(id)).filter((project) => project !== undefined)
    : [];

  if (loader === "init-loader") return <Spinner />;

  return <PowerKProjectsMenu projects={projectsList} onSelect={handleSelect} />;
});
