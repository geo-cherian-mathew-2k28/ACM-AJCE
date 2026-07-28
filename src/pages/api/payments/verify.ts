import type { APIRoute } from "astro";
import {
  activateMembership,
  getDatabase,
  getRequiredSecret,
  json,
  MembershipError,
  requireUser,
  toApiError,
  verifyHmacHex,
} from "../../../lib/membership";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = await requireUser(request, locals);
    const body = (await request.json()) as Record<string, unknown>;
    const orderId = String(body.razorpay_order_id ?? "");
    const paymentId = String(body.razorpay_payment_id ?? "");
    const signature = String(body.razorpay_signature ?? "");
    if (!orderId || !paymentId || !signature) {
      throw new MembershipError("The payment confirmation was incomplete.", 400);
    }

    const signatureIsValid = await verifyHmacHex(
      `${orderId}|${paymentId}`,
      signature,
      getRequiredSecret(locals, "RAZORPAY_KEY_SECRET")
    );
    if (!signatureIsValid) {
      throw new MembershipError("Payment signature verification failed.", 400);
    }

    const database = getDatabase(locals);
    const payment = await database
      .prepare("SELECT * FROM payments WHERE razorpay_order_id = ? AND user_id = ? LIMIT 1")
      .bind(orderId, user.id)
      .first<{ id: string; razorpay_payment_id: string | null }>();
    if (!payment) throw new MembershipError("This payment does not belong to your account.", 404);
    if (payment.razorpay_payment_id && payment.razorpay_payment_id !== paymentId) {
      throw new MembershipError("This order was already linked to another payment.", 409);
    }

    await database
      .prepare(
        `UPDATE payments
         SET status = 'verified', razorpay_payment_id = ?, verified_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(paymentId, payment.id)
      .run();
    const membership = await activateMembership(database, user.id, paymentId);
    return json({ ok: true, membership });
  } catch (error) {
    return toApiError(error);
  }
};
