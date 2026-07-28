import type { APIRoute } from "astro";
import { getDatabase, json, requireAdmin, toApiError } from "../../../lib/membership";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    await requireAdmin(request, locals);
    const database = getDatabase(locals);
    const members = await database
      .prepare(
        `SELECT users.id, users.full_name, users.email, users.phone, users.department,
                users.study_year, users.admission_number, users.profile_complete,
                memberships.member_number, memberships.status AS membership_status,
                memberships.starts_at, memberships.expires_at,
                payments.razorpay_payment_id, payments.amount_paise
         FROM users
         LEFT JOIN memberships ON memberships.id = (
           SELECT id FROM memberships
           WHERE memberships.user_id = users.id
           ORDER BY memberships.expires_at DESC LIMIT 1
         )
         LEFT JOIN payments ON payments.id = (
           SELECT id FROM payments
           WHERE payments.user_id = users.id
             AND payments.status IN ('verified', 'captured')
           ORDER BY payments.verified_at DESC, payments.created_at DESC
           LIMIT 1
         )
         ORDER BY users.created_at DESC`
      )
      .all();
    return json({ members: members.results ?? [] });
  } catch (error) {
    return toApiError(error);
  }
};
