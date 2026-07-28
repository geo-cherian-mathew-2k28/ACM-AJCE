import type { APIRoute } from "astro";
import {
  createCouponCode,
  decryptCouponCode,
  encryptCouponCode,
  getActiveMembership,
  getDatabase,
  hashCoupon,
  json,
  requireUser,
  toApiError,
} from "../../../lib/membership";

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

    const upcomingEvents = upcoming.results ?? [];
    if (membership) {
      for (const event of upcomingEvents as Array<Record<string, any>>) {
        if (!event.coupon_enabled || event.registration_status || !event.registration_open) continue;
        let coupon = await database
          .prepare(
            `SELECT id, code_ciphertext, code_prefix, discount_amount_paise, expires_at, used_at
             FROM coupons WHERE event_id = ? AND assigned_user_id = ? LIMIT 1`
          )
          .bind(event.id, user.id)
          .first<any>();
        if (!coupon) {
          const code = createCouponCode();
          await database
            .prepare(
              `INSERT OR IGNORE INTO coupons
               (id, event_id, assigned_user_id, code_hash, code_ciphertext, code_prefix,
                discount_amount_paise, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              crypto.randomUUID(),
              event.id,
              user.id,
              await hashCoupon(code, locals),
              await encryptCouponCode(code, locals),
              code.slice(0, 9),
              Number(event.coupon_discount_amount_paise ?? 0),
              event.registration_deadline ?? null
            )
            .run();
          coupon = await database
            .prepare(
              `SELECT id, code_ciphertext, code_prefix, discount_amount_paise, expires_at, used_at
               FROM coupons WHERE event_id = ? AND assigned_user_id = ? LIMIT 1`
            )
            .bind(event.id, user.id)
            .first<any>();
        }
        event.member_coupon_code = await decryptCouponCode(coupon?.code_ciphertext ?? null, locals);
        event.member_coupon_prefix = coupon?.code_prefix ?? null;
        event.member_coupon_discount_amount_paise = coupon?.discount_amount_paise ?? 0;
        event.member_coupon_used_at = coupon?.used_at ?? null;
      }
    }

    return json({
      user,
      membership: membership ?? null,
      upcoming: upcomingEvents,
      registrations: registrations.results ?? [],
      certificates: certificates.results ?? [],
      transactions: transactions.results ?? [],
    });
  } catch (error) {
    return toApiError(error);
  }
};
