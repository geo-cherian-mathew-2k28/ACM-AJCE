import type { APIRoute } from "astro";
import {
  getActiveMembership,
  getCurrentUser,
  getDatabase,
  toApiError,
} from "../../../lib/membership";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = await getCurrentUser(request, locals);
    if (!user) return new Response(null, { status: 401 });
    const membership = await getActiveMembership(getDatabase(locals), user.id);
    return new Response(JSON.stringify({ user, membership: membership ?? null }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return toApiError(error);
  }
};
