# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re
import secrets
from urllib.parse import urlparse

from django.core.cache import cache

DESKTOP_AUTH_CODE_TTL_SECONDS = 300
DESKTOP_AUTH_SESSION_KEY = "desktop_auth_redirect_uri"
DESKTOP_AUTH_CODE_PREFIX = "desktop_auth_code:"

_LOOPBACK_CALLBACK_PATTERN = re.compile(
    r"^https?://(127\.0\.0\.1|localhost):\d{1,5}/callback/?$",
    re.IGNORECASE,
)


def is_valid_desktop_redirect_uri(redirect_uri: str) -> bool:
    if not redirect_uri or not isinstance(redirect_uri, str):
        return False

    if len(redirect_uri) > 500:
        return False

    if not _LOOPBACK_CALLBACK_PATTERN.match(redirect_uri):
        return False

    parsed = urlparse(redirect_uri)
    if parsed.port is None or parsed.port < 1024 or parsed.port > 65535:
        return False

    return True


def store_desktop_redirect_uri(request, redirect_uri: str) -> None:
    request.session[DESKTOP_AUTH_SESSION_KEY] = redirect_uri
    request.session.save()


def get_desktop_redirect_uri(request) -> str | None:
    redirect_uri = request.session.get(DESKTOP_AUTH_SESSION_KEY)
    if isinstance(redirect_uri, str) and is_valid_desktop_redirect_uri(redirect_uri):
        return redirect_uri
    return None


def clear_desktop_redirect_uri(request) -> None:
    if DESKTOP_AUTH_SESSION_KEY in request.session:
        del request.session[DESKTOP_AUTH_SESSION_KEY]
        request.session.save()


def create_desktop_auth_code(user_id: str, redirect_uri: str) -> str:
    code = secrets.token_urlsafe(32)
    cache.set(
        f"{DESKTOP_AUTH_CODE_PREFIX}{code}",
        {"user_id": user_id, "redirect_uri": redirect_uri},
        DESKTOP_AUTH_CODE_TTL_SECONDS,
    )
    return code


def consume_desktop_auth_code(code: str, redirect_uri: str | None = None) -> dict | None:
    if not code or not isinstance(code, str):
        return None

    cache_key = f"{DESKTOP_AUTH_CODE_PREFIX}{code}"
    payload = cache.get(cache_key)
    if not payload:
        return None

    stored_redirect_uri = payload.get("redirect_uri")
    if not isinstance(stored_redirect_uri, str) or not is_valid_desktop_redirect_uri(stored_redirect_uri):
        return None

    if redirect_uri is not None and stored_redirect_uri != redirect_uri:
        return None

    cache.delete(cache_key)
    return payload
