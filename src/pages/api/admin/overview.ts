import type { APIRoute } from "astro";
import { getDatabase, json, requireAdmin, toApiError } from "../../../lib/membership";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    await requireAdmin(request, locals);
    const database = getDatabase(locals);
    const [users, members, funds, events] = await database.batch([
      database.prepare("SELECT COUNT(*) AS total FROM users"),
      database.prepare(
        "SELECT COUNT(*) AS total FROM memberships WHERE status = 'active' AND expires_at > ?"
      ).bind(new Date().toISOString()),
      database.prepare(
        "SELECT COALESCE(SUM(amount_paise), 0) AS paise FROM payments WHERE status IN ('verified', 'captured')"
      ),
      database.prepare("SELECT COUNT(*) AS total FROM events WHERE published = 1"),
    ]);
    return json({
      users: users.results?.[0]?.total ?? 0,
      activeMembers: members.results?.[0]?.total ?? 0,
      fundsPaise: funds.results?.[0]?.paise ?? 0,
      publishedEvents: events.results?.[0]?.total ?? 0,
    });
  } catch (error) {
    return toApiError(error);
  }
};
