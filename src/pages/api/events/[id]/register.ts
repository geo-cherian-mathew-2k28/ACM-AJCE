import type { APIRoute } from "astro";
import {
  getActiveMembership,
  getDatabase,
  hashCoupon,
  json,
  MembershipError,
  requireUser,
  toApiError,
} from "../../../../lib/membership";

export const prerender = false;

type EventRecord = {
  id: string;
  title: string;
  registration_open: number;
  registration_deadline: string | null;
  capacity: number | null;
  member_only: number;
  registration_fee_paise: number;
  coupon_enabled: number;
};

type CouponRecord = {
  id: string;
  expires_at: string | null;
  used_at: string | null;
  discount_amount_paise: number;
};

export const POST: APIRoute = async ({ request, params, locals }) => {
  try {
    const eventId = params.id;
    if (!eventId) throw new MembershipError("Event not found.", 404);

    const user = await requireUser(request, locals);
    const database = getDatabase(locals);
    const event = await database
      .prepare("SELECT * FROM events WHERE id = ? AND published = 1 LIMIT 1")
      .bind(eventId)
      .first<EventRecord>();
    if (!event) throw new MembershipError("Event not found.", 404);
    if (!event.registration_open) {
      throw new MembershipError("Registrations are not open for this event.", 409);
    }
    if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
      throw new MembershipError("The registration window has closed.", 409);
    }
    if (event.member_only && !(await getActiveMembership(database, user.id))) {
      throw new MembershipError("An active ACM AJCE membership is required for this event.", 403);
    }

    const existingRegistration = await database
      .prepare("SELECT id FROM event_registrations WHERE event_id = ? AND user_id = ? LIMIT 1")
      .bind(event.id, user.id)
      .first();
    if (existingRegistration) {
      throw new MembershipError("You have already registered for this event.", 409);
    }

    if (event.capacity !== null) {
      const count = await database
        .prepare(
          "SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ? AND status = 'registered'"
        )
        .bind(event.id)
        .first<{ total: number }>();
      if ((count?.total ?? 0) >= event.capacity) {
        throw new MembershipError("This event has reached its capacity.", 409);
      }
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const couponCode = String(body.couponCode ?? "").trim();
    let couponId: string | null = null;
    let discountAmountPaise = 0;
    if (couponCode) {
      const codeHash = await hashCoupon(couponCode, locals);
      const coupon = await database
        .prepare(
          `SELECT id, expires_at, used_at, discount_amount_paise FROM coupons
           WHERE event_id = ? AND assigned_user_id = ? AND code_hash = ? LIMIT 1`
        )
        .bind(event.id, user.id, codeHash)
        .first<CouponRecord>();
      if (!coupon || coupon.used_at) {
        throw new MembershipError("This coupon is invalid or has already been used.", 400);
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        throw new MembershipError("This coupon has expired.", 400);
      }
      const result = await database
        .prepare("UPDATE coupons SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL")
        .bind(coupon.id)
        .run();
      if ((result.meta?.changes ?? 0) !== 1) {
        throw new MembershipError("This coupon has already been used.", 409);
      }
      couponId = coupon.id;
      discountAmountPaise = event.coupon_enabled ? Number(coupon.discount_amount_paise ?? 0) : 0;
    }

    const registration = {
      id: crypto.randomUUID(),
      eventId: event.id,
      userId: user.id,
      couponId,
    };
    await database
      .prepare(
        `INSERT INTO event_registrations
         (id, event_id, user_id, coupon_id, discount_amount_paise, status)
         VALUES (?, ?, ?, ?, ?, 'registered')`
      )
      .bind(registration.id, registration.eventId, registration.userId, registration.couponId, discountAmountPaise)
      .run();

    return json({
      ok: true,
      registration,
      discountAmountPaise,
      payableAmountPaise: Math.max(0, Number(event.registration_fee_paise ?? 0) - discountAmountPaise),
    });
  } catch (error) {
    return toApiError(error);
  }
};
