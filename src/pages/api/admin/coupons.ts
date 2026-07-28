import type { APIRoute } from "astro";
import {
  createCouponCode,
  getDatabase,
  hashCoupon,
  json,
  MembershipError,
  requireAdmin,
  toApiError,
} from "../../../lib/membership";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    await requireAdmin(request, locals);
    const coupons = await getDatabase(locals)
      .prepare(
        `SELECT coupons.id, coupons.discount_amount_paise, coupons.expires_at, coupons.used_at,
                coupons.created_at, events.title AS event_title,
                users.full_name AS member_name, users.email AS member_email
         FROM coupons
         INNER JOIN events ON events.id = coupons.event_id
         INNER JOIN users ON users.id = coupons.assigned_user_id
         ORDER BY coupons.created_at DESC
         LIMIT 100`
      )
      .all();
    return json({ coupons: coupons.results ?? [] });
  } catch (error) {
    return toApiError(error);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const admin = await requireAdmin(request, locals);
    const body = (await request.json()) as Record<string, unknown>;
    const eventId = String(body.eventId ?? "").trim();
    const userId = String(body.userId ?? "").trim();
    const expiry = String(body.expiresAt ?? "").trim();
    const discountAmountPaise = Number(body.discountAmountPaise ?? 0);
    if (!eventId || !userId) {
      throw new MembershipError("Choose both an event and a member.", 400);
    }
    if (!Number.isInteger(discountAmountPaise) || discountAmountPaise < 0) {
      throw new MembershipError("Coupon discount must be a valid amount.", 400);
    }
    const expiresAt = expiry ? new Date(expiry) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new MembershipError("Coupon expiry must be a valid date.", 400);
    }

    const database = getDatabase(locals);
    const event = await database.prepare("SELECT id FROM events WHERE id = ? LIMIT 1").bind(eventId).first();
    const user = await database.prepare("SELECT id FROM users WHERE id = ? LIMIT 1").bind(userId).first();
    if (!event || !user) throw new MembershipError("The event or member no longer exists.", 404);

    const code = createCouponCode();
    await database
      .prepare(
        `INSERT INTO coupons
         (id, event_id, assigned_user_id, code_hash, discount_amount_paise, expires_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        eventId,
        userId,
        await hashCoupon(code, locals),
        discountAmountPaise,
        expiresAt?.toISOString() ?? null,
        admin.id
      )
      .run();
    return json({ ok: true, code }, 201);
  } catch (error) {
    return toApiError(error);
  }
};
