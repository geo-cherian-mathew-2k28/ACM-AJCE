import type { APIRoute } from "astro";
import { getActiveMembership, getDatabase, json, requireUser, toApiError } from "../../../lib/membership";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const user = await requireUser(request, locals);
    const database = getDatabase(locals);
    const membership = await getActiveMembership(database, user.id);
    const now = new Date().toISOString();
    const [upcoming, registrations, certificates, transactions] = await database.batch([
      database
        .prepare(
          `SELECT events.*, event_registrations.status AS registration_status,
                  event_registrations.created_at AS registered_at
           FROM events
           LEFT JOIN event_registrations
             ON event_registrations.event_id = events.id
            AND event_registrations.user_id = ?
           WHERE events.published = 1 AND events.starts_at >= ?
           ORDER BY events.starts_at ASC
           LIMIT 8`
        )
        .bind(user.id, now),
      database
        .prepare(
          `SELECT events.id, events.title, events.slug, events.summary, events.venue,
                  events.starts_at, events.ends_at, events.poster_url, events.event_url,
                  events.whatsapp_url, events.after_registration_content,
                  event_registrations.status, event_registrations.created_at AS registered_at
           FROM event_registrations
           INNER JOIN events ON events.id = event_registrations.event_id
           WHERE event_registrations.user_id = ?
           ORDER BY events.starts_at DESC`
        )
        .bind(user.id),
      database
        .prepare(
          `SELECT certificates.id, certificates.certificate_number, certificates.status,
                  certificates.issued_at, events.title AS event_title, events.starts_at
           FROM certificates
           INNER JOIN events ON events.id = certificates.event_id
           WHERE certificates.user_id = ?
           ORDER BY certificates.issued_at DESC`
        )
        .bind(user.id),
      database
        .prepare(
          `SELECT id, amount_paise, currency, status, razorpay_payment_id,
                  receipt, created_at, verified_at
           FROM payments
           WHERE user_id = ?
           ORDER BY created_at DESC`
        )
        .bind(user.id),
    ]);

    return json({
      user,
      membership: membership ?? null,
      upcoming: upcoming.results ?? [],
      registrations: registrations.results ?? [],
      certificates: certificates.results ?? [],
      transactions: transactions.results ?? [],
    });
  } catch (error) {
    return toApiError(error);
  }
};
