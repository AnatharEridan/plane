# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

MAX_BUG_TRACKING_VALUE_LENGTH = 255


def normalize_bug_found_locations(value):
    if not isinstance(value, list):
        raise ValueError("Bug found locations must be a list.")

    normalized_locations = []
    normalized_keys = set()

    for location in value:
        if not isinstance(location, str):
            raise ValueError("Each bug found location must be a string.")

        normalized_location = location.strip()
        if not normalized_location:
            raise ValueError("Bug found locations cannot be empty.")
        if len(normalized_location) > MAX_BUG_TRACKING_VALUE_LENGTH:
            raise ValueError(f"Bug found locations cannot exceed {MAX_BUG_TRACKING_VALUE_LENGTH} characters.")

        normalized_key = normalized_location.casefold()
        if normalized_key in normalized_keys:
            raise ValueError("Bug found locations must be unique.")

        normalized_keys.add(normalized_key)
        normalized_locations.append(normalized_location)

    return normalized_locations
