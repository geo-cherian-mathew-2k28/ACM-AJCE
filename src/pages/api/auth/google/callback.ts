import type { APIRoute } from "astro";
import {
  clearOauthStateHeader,
  createSession,
  getDatabase,
  getRequiredSecret,
  isAdminEmail,
  MembershipError,
  readOauthState,
  sessionHeader,
  toApiError,
} from "../../../../lib/membership";

export const prerender = false;

type GoogleUser = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
};

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const storedState = readOauthState(request);
    if (!code || !state || !storedState || state !== storedState) {
      throw new MembershipError("Your Google sign-in session expired. Please try again.", 401);
    }

    const clientId = getRequiredSecret(locals, "GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = getRequiredSecret(locals, "GOOGLE_OAUTH_CLIENT_SECRET");
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new MembershipError("Google could not verify this sign-in. Please try again.", 401);
    }

    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokens.access_token) {
      throw new MembershipError("Google did not return an account token.", 401);
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await profileResponse.json()) as GoogleUser;
    const verified = profile.email_verified === true || profile.email_verified === "true";
    if (!profileResponse.ok || !profile.sub || !profile.email || !verified) {
      throw new MembershipError("Please use a verified Google email address.", 401);
    }

    const database = getDatabase(locals);
    const userId = crypto.randomUUID();
    const role = isAdminEmail(profile.email, locals) ? "admin" : "member";
    await database
      .prepare(
        `INSERT INTO users (id, google_sub, email, full_name, avatar_url, role)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(google_sub) DO UPDATE SET
           email = excluded.email,
           full_name = excluded.full_name,
           avatar_url = excluded.avatar_url,
           role = excluded.role,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        userId,
        profile.sub,
        profile.email.toLowerCase(),
        profile.name?.trim() || profile.email,
        profile.picture ?? null,
        role
      )
      .run();

    const user = await database
      .prepare("SELECT id FROM users WHERE google_sub = ? LIMIT 1")
      .bind(profile.sub)
      .first<{ id: string }>();
    if (!user) throw new MembershipError("Unable to create your member profile.", 500);

    const token = await createSession(
      user.id,
      getRequiredSecret(locals, "MEMBERSHIP_SESSION_SECRET")
    );
    const headers = new Headers({
      location: "/membership",
      "cache-control": "no-store",
    });
    headers.append("set-cookie", sessionHeader(request, token));
    headers.append("set-cookie", clearOauthStateHeader(request));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return toApiError(error);
  }
};
