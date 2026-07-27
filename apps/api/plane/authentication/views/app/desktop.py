# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.http import HttpResponseRedirect, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from plane.authentication.adapter.error import AUTHENTICATION_ERROR_CODES, AuthenticationException
from plane.authentication.utils.desktop_auth import (
    clear_desktop_redirect_uri,
    create_desktop_auth_code,
    consume_desktop_auth_code,
    get_desktop_redirect_uri,
    is_valid_desktop_redirect_uri,
    store_desktop_redirect_uri,
)
from plane.authentication.utils.host import base_host
from plane.utils.ip_address import get_client_ip

User = get_user_model()


def _get_web_base_url() -> str:
    return (settings.WEB_URL or settings.APP_BASE_URL or "").rstrip("/")


class DesktopAuthStartEndpoint(View):
    def get(self, request):
        redirect_uri = request.GET.get("redirect_uri", "")

        if not is_valid_desktop_redirect_uri(redirect_uri):
            return JsonResponse(
                {"error": "INVALID_REDIRECT_URI", "message": "Desktop redirect URI is invalid."},
                status=400,
            )

        store_desktop_redirect_uri(request, redirect_uri)

        web_base_url = _get_web_base_url()
        complete_url = f"{web_base_url}/desktop-auth/complete"

        if request.user.is_authenticated:
            return HttpResponseRedirect(complete_url)

        return HttpResponseRedirect(f"{web_base_url}/?next_path=/desktop-auth/complete")


@method_decorator(csrf_exempt, name="dispatch")
class DesktopAuthIssueCodeEndpoint(View):
    def post(self, request):
        if not request.user.is_authenticated:
            return JsonResponse(
                {"error": "AUTHENTICATION_REQUIRED", "message": "Sign in through your browser first."},
                status=401,
            )

        fallback_redirect_uri = None
        if request.body:
            try:
                payload = json.loads(request.body.decode("utf-8"))
                candidate = payload.get("redirect_uri")
                if isinstance(candidate, str):
                    fallback_redirect_uri = candidate
            except json.JSONDecodeError:
                pass

        redirect_uri = get_desktop_redirect_uri(request, fallback_redirect_uri=fallback_redirect_uri)
        if not redirect_uri:
            return JsonResponse(
                {"error": "DESKTOP_AUTH_NOT_STARTED", "message": "Desktop sign-in was not initiated."},
                status=400,
            )

        code = create_desktop_auth_code(str(request.user.pk), redirect_uri)
        clear_desktop_redirect_uri(request)

        return JsonResponse({"code": code, "redirect_uri": redirect_uri})


@method_decorator(csrf_exempt, name="dispatch")
class DesktopAuthExchangeEndpoint(View):
    def post(self, request):
        try:
            payload = json.loads(request.body.decode("utf-8") if request.body else "{}")
        except json.JSONDecodeError:
            payload = {}

        code = payload.get("code")
        redirect_uri = payload.get("redirect_uri")

        if not redirect_uri or not is_valid_desktop_redirect_uri(redirect_uri):
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["AUTHENTICATION_FAILED_SIGN_IN"],
                error_message="DESKTOP_AUTH_REDIRECT_URI_INVALID",
            )
            return JsonResponse(exc.get_error_dict(), status=400)

        auth_payload = consume_desktop_auth_code(code, redirect_uri=redirect_uri)
        if not auth_payload:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["AUTHENTICATION_FAILED_SIGN_IN"],
                error_message="DESKTOP_AUTH_CODE_INVALID",
            )
            return JsonResponse(exc.get_error_dict(), status=400)

        user = User.objects.filter(pk=auth_payload["user_id"]).first()
        if not user:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["USER_DOES_NOT_EXIST"],
                error_message="USER_DOES_NOT_EXIST",
            )
            return JsonResponse(exc.get_error_dict(), status=404)

        login(request, user)
        request.session["device_info"] = {
            "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            "ip_address": get_client_ip(request=request),
            "domain": base_host(request=request, is_app=True),
            "client": "desktop",
        }
        request.session.set_expiry(settings.SESSION_COOKIE_AGE)
        request.session.save()

        return JsonResponse(
            {
                "session_key": request.session.session_key,
                "session_cookie_name": settings.SESSION_COOKIE_NAME,
                "session_cookie_domain": settings.SESSION_COOKIE_DOMAIN,
                "expires_in": settings.SESSION_COOKIE_AGE,
            }
        )
