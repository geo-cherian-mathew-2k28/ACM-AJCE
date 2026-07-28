import type { APIRoute } from "astro";
import { getDatabase, json, requireUser, toApiError } from "../../../lib/membership";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = await requireUser(request, locals);
    const database = getDatabase(locals);
    const events = await database
      .prepare(
        `SELECT events.*, event_registrations.status AS registration_status,
                event_registrations.created_at AS registered_at
         FROM events
         LEFT JOIN event_registrations
           ON event_registrations.event_id = events.id
          AND event_registrations.user_id = ?
         WHERE events.published = 1
         ORDER BY events.starts_at ASC`
      )
      .bind(user.id)
      .all();
    return json({ events: events.results ?? [] });
  } catch (error) {
    return toApiError(error);
  }
};
