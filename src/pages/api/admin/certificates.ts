import type { APIRoute } from "astro";
import { getDatabase, json, MembershipError, requireAdmin, toApiError } from "../../../lib/membership";

export const prerender = false;

const certificateNumber = () => {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `AJCE-CERT-${year}-${suffix}`;
};

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    await requireAdmin(request, locals);
    const database = getDatabase(locals);
    const events = await database
      .prepare(
        `SELECT events.id, events.title, events.starts_at, events.venue, events.published,
                COUNT(DISTINCT CASE WHEN event_registrations.status = 'registered' THEN event_registrations.user_id END) AS registrant_count,
                COUNT(DISTINCT certificates.id) AS issued_count
         FROM events
         LEFT JOIN event_registrations ON event_registrations.event_id = events.id
         LEFT JOIN certificates ON certificates.event_id = events.id AND certificates.status = 'issued'
         GROUP BY events.id
         ORDER BY events.starts_at DESC`
      )
      .all();
    return json({ events: events.results ?? [] });
  } catch (error) {
    return toApiError(error);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const admin = await requireAdmin(request, locals);
    const body = (await request.json()) as { eventId?: unknown; userIds?: unknown };
    const eventId = String(body.eventId ?? "").trim();
    if (!eventId) throw new MembershipError("Choose an event before issuing certificates.", 400);

    const database = getDatabase(locals);
    const event = await database
      .prepare("SELECT id FROM events WHERE id = ? LIMIT 1")
      .bind(eventId)
      .first<{ id: string }>();
    if (!event) throw new MembershipError("That event could not be found.", 404);

    const requestedIds = Array.isArray(body.userIds)
      ? body.userIds.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const registrations = await database
      .prepare(
        `SELECT user_id FROM event_registrations
         WHERE event_id = ? AND status = 'registered'`
      )
      .bind(eventId)
      .all<{ user_id: string }>();
    const eligible = (registrations.results ?? []).map((row) => row.user_id);
    const recipientIds = requestedIds.length
      ? eligible.filter((id) => requestedIds.includes(id))
      : eligible;
    if (!recipientIds.length) {
      throw new MembershipError("No registered participants are eligible for this event.", 400);
    }

    const before = await database
      .prepare("SELECT COUNT(*) AS total FROM certificates WHERE event_id = ? AND status = 'issued'")
      .bind(eventId)
      .first<{ total: number }>();
    const statements = recipientIds.map((userId) =>
      database
        .prepare(
          `INSERT OR IGNORE INTO certificates
           (id, event_id, user_id, certificate_number, status, issued_by, issued_at)
           VALUES (?, ?, ?, ?, 'issued', ?, ?)`
        )
        .bind(crypto.randomUUID(), eventId, userId, certificateNumber(), admin.id, new Date().toISOString())
    );
    if (statements.length) await database.batch(statements);
    const after = await database
      .prepare("SELECT COUNT(*) AS total FROM certificates WHERE event_id = ? AND status = 'issued'")
      .bind(eventId)
      .first<{ total: number }>();
    const issued = Math.max(0, Number(after?.total ?? 0) - Number(before?.total ?? 0));
    return json({ ok: true, issued, alreadyIssued: recipientIds.length - issued });
  } catch (error) {
    return toApiError(error);
  }
};
