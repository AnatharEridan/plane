/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { usePathname } from "next/navigation";
import { Outlet } from "react-router";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { getProjectActivePath } from "@/components/settings/helper";
import { SettingsMobileNav } from "@/components/settings/mobile/nav";
// layouts
import { ProjectAuthWrapper } from "@/layouts/auth-layout/project-wrapper";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
// types
import type { Route } from "./+types/layout";
import { ProjectSettingsSidebarRoot } from "@/components/settings/project/sidebar";

const ProjectDetailSettingsLayout = observer(function ProjectDetailSettingsLayout({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  // router
  const pathname = usePathname();
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  // derived values
  const isProjectAdmin = allowPermissions(
    [EUserPermissions.ADMIN],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  return (
    <>
      <SettingsMobileNav
        hamburgerContent={(props) => <ProjectSettingsSidebarRoot {...props} projectId={projectId} />}
        activePath={getProjectActivePath(pathname) || ""}
      />
      <div className="inset-y-0 flex h-full w-full flex-row">
        <div className="relative flex size-full">
          <div className="hidden h-full shrink-0 md:block">
            <ProjectSettingsSidebarRoot projectId={projectId} />
          </div>
          <ProjectAuthWrapper workspaceSlug={workspaceSlug} projectId={projectId}>
            {workspaceUserInfo && !isProjectAdmin ? (
              <NotAuthorizedView section="settings" isProjectView className="h-auto" />
            ) : (
              <Outlet />
            )}
          </ProjectAuthWrapper>
        </div>
      </div>
    </>
  );
});

export default ProjectDetailSettingsLayout;
