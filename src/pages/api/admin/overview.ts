import type { APIRoute } from "astro";
import { getDatabase, json, requireAdmin, toApiError } from "../../../lib/membership";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    await requireAdmin(request, locals);
    const database = getDatabase(locals);
    const now = new Date().toISOString();
    const [users, members, membershipFunds, manualFunds, events, openEvents, registrations, coupons] = await database.batch([
      database.prepare("SELECT COUNT(*) AS total FROM users"),
      database.prepare(
        "SELECT COUNT(*) AS total FROM memberships WHERE status = 'active' AND expires_at > ?"
      ).bind(now),
      database.prepare(
        "SELECT COALESCE(SUM(amount_paise), 0) AS paise FROM payments WHERE status IN ('verified', 'captured')"
      ),
      database.prepare(
        `SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_paise ELSE -amount_paise END), 0) AS paise
         FROM chapter_fund_entries`
      ),
      database.prepare("SELECT COUNT(*) AS total FROM events WHERE published = 1"),
      database.prepare(
        "SELECT COUNT(*) AS total FROM events WHERE published = 1 AND registration_open = 1 AND starts_at > ?"
      ).bind(now),
      database.prepare(
        "SELECT COUNT(*) AS total FROM event_registrations WHERE status = 'registered'"
      ),
      database.prepare("SELECT COUNT(*) AS total FROM coupons"),
    ]);
    return json({
      users: users.results?.[0]?.total ?? 0,
      activeMembers: members.results?.[0]?.total ?? 0,
      membershipFundsPaise: membershipFunds.results?.[0]?.paise ?? 0,
      manualFundsPaise: manualFunds.results?.[0]?.paise ?? 0,
      fundsPaise: Number(membershipFunds.results?.[0]?.paise ?? 0) + Number(manualFunds.results?.[0]?.paise ?? 0),
      publishedEvents: events.results?.[0]?.total ?? 0,
      openEvents: openEvents.results?.[0]?.total ?? 0,
      registrations: registrations.results?.[0]?.total ?? 0,
      couponsIssued: coupons.results?.[0]?.total ?? 0,
    });
  } catch (error) {
    return toApiError(error);
  }
};
