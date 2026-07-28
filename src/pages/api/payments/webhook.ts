import type { APIRoute } from "astro";
import {
  activateMembership,
  getDatabase,
  getRequiredSecret,
  MembershipError,
  toApiError,
  verifyHmacHex,
} from "../../../lib/membership";

export const prerender = false;

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
  };
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    const eventId = request.headers.get("x-razorpay-event-id") ?? "";
    if (!signature || !eventId) {
      throw new MembershipError("Invalid Razorpay webhook request.", 400);
    }

    const valid = await verifyHmacHex(
      body,
      signature,
      getRequiredSecret(locals, "RAZORPAY_WEBHOOK_SECRET")
    );
    if (!valid) throw new MembershipError("Invalid Razorpay webhook signature.", 400);

    const payload = JSON.parse(body) as RazorpayWebhook;
    const database = getDatabase(locals);
    const alreadyProcessed = await database
      .prepare("SELECT razorpay_event_id FROM payment_webhook_events WHERE razorpay_event_id = ? LIMIT 1")
      .bind(eventId)
      .first();
    if (alreadyProcessed) return new Response(null, { status: 204 });

    try {
      await database
        .prepare(
          "INSERT INTO payment_webhook_events (razorpay_event_id, event_type) VALUES (?, ?)"
        )
        .bind(eventId, payload.event ?? "unknown")
        .run();
    } catch (error) {
      const duplicate = await database
        .prepare("SELECT razorpay_event_id FROM payment_webhook_events WHERE razorpay_event_id = ? LIMIT 1")
        .bind(eventId)
        .first();
      if (duplicate) return new Response(null, { status: 204 });
      throw error;
    }

    if (payload.event === "payment.captured") {
      const orderId = payload.payload?.payment?.entity?.order_id;
      const paymentId = payload.payload?.payment?.entity?.id;
      if (orderId && paymentId) {
        const payment = await database
          .prepare("SELECT id, user_id FROM payments WHERE razorpay_order_id = ? LIMIT 1")
          .bind(orderId)
          .first<{ id: string; user_id: string }>();
        if (payment) {
          await database
            .prepare(
              `UPDATE payments
               SET status = 'captured', razorpay_payment_id = ?, verified_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            )
            .bind(paymentId, payment.id)
            .run();
          await activateMembership(database, payment.user_id, paymentId);
        }
      }
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return toApiError(error);
  }
};
