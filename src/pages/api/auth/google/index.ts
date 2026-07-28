import type { APIRoute } from "astro";
import {
  createOauthState,
  getRequiredSecret,
  oauthStateHeader,
  toApiError,
} from "../../../../lib/membership";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const clientId = getRequiredSecret(locals, "GOOGLE_OAUTH_CLIENT_ID");
    const url = new URL(request.url);
    const state = createOauthState();
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    googleUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    }).toString();

    return new Response(null, {
      status: 302,
      headers: {
        location: googleUrl.toString(),
        "set-cookie": oauthStateHeader(request, state),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return toApiError(error);
  }
};
