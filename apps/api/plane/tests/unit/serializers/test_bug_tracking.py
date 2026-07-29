# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.app.serializers import DraftIssueCreateSerializer, IssueCreateSerializer, ProjectSerializer
from plane.db.models import Project


@pytest.mark.unit
@pytest.mark.django_db
class TestBugTrackingSerializers:
    def test_project_locations_are_trimmed(self, workspace):
        project = Project.objects.create(name="Test Project", identifier="TEST", workspace=workspace)
        serializer = ProjectSerializer(
            project,
            data={"bug_found_locations": [" Web ", "iOS"]},
            partial=True,
            context={"workspace_id": workspace.id},
        )

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["bug_found_locations"] == ["Web", "iOS"]

    def test_project_locations_must_be_unique(self, workspace):
        project = Project.objects.create(name="Test Project", identifier="TEST", workspace=workspace)
        serializer = ProjectSerializer(
            project,
            data={"bug_found_locations": ["Web", " web "]},
            partial=True,
            context={"workspace_id": workspace.id},
        )

        assert not serializer.is_valid()
        assert "bug_found_locations" in serializer.errors

    @pytest.mark.parametrize("serializer_class", [IssueCreateSerializer, DraftIssueCreateSerializer])
    def test_issue_location_must_be_configured_for_project(self, workspace, serializer_class):
        project = Project.objects.create(
            name="Test Project",
            identifier="TEST",
            workspace=workspace,
            bug_found_locations=["Web", "Android"],
        )

        valid_serializer = serializer_class(
            data={
                "name": "Broken navigation",
                "bug_found_location": "Web",
                "affected_version": "2.4.1",
            },
            context={"project_id": project.id, "workspace_id": workspace.id, "default_assignee_id": None},
        )
        invalid_serializer = serializer_class(
            data={"name": "Broken navigation", "bug_found_location": "Desktop"},
            context={"project_id": project.id, "workspace_id": workspace.id, "default_assignee_id": None},
        )

        assert valid_serializer.is_valid(), valid_serializer.errors
        assert valid_serializer.validated_data["affected_version"] == "2.4.1"
        assert not invalid_serializer.is_valid()
        assert "bug_found_location" in invalid_serializer.errors
