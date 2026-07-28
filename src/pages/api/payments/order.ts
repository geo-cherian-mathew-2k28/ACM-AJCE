import type { APIRoute } from "astro";
import {
  createRazorpayOrder,
  getActiveMembership,
  getDatabase,
  json,
  MEMBERSHIP_PRICE_LABEL,
  requireUser,
  toApiError,
} from "../../../lib/membership";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = await requireUser(request, locals);
    if (!user.profile_complete) {
      return json({ message: "Complete your membership profile before payment." }, 400);
    }

    const database = getDatabase(locals);
    const activeMembership = await getActiveMembership(database, user.id);
    if (activeMembership) {
      return json({ message: "Your ACM AJCE membership is already active." }, 409);
    }

    const receipt = `mem_${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`;
    const { keyId, order } = await createRazorpayOrder(locals, {
      receipt,
      userId: user.id,
    });

    await database
      .prepare(
        `INSERT INTO payments (id, user_id, amount_paise, currency, status, razorpay_order_id, receipt)
         VALUES (?, ?, ?, 'INR', 'created', ?, ?)`
      )
      .bind(crypto.randomUUID(), user.id, order.amount, order.id, receipt)
      .run();

    return json({
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: "ACM AJCE",
      description: `Annual Local Chapter Membership - ${MEMBERSHIP_PRICE_LABEL}`,
      prefill: {
        name: user.full_name,
        email: user.email,
        contact: user.phone,
      },
    });
  } catch (error) {
    return toApiError(error);
  }
};
