import type { APIRoute } from "astro";
import { getDatabase, json, MembershipError, requireAdmin, toApiError } from "../../../../lib/membership";

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  try {
    await requireAdmin(request, locals);
    const id = params.id;
    if (!id) throw new MembershipError("Member not found.", 404);
    const body = (await request.json()) as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const department = String(body.department ?? "").trim();
    const studyYear = String(body.studyYear ?? "").trim();
    const admissionNumber = String(body.admissionNumber ?? "").trim();
    if (!fullName || !phone || !department || !studyYear || !admissionNumber) {
      throw new MembershipError("Complete every member detail before saving.", 400);
    }
    const result = await getDatabase(locals)
      .prepare(
        `UPDATE users
         SET full_name = ?, phone = ?, department = ?, study_year = ?, admission_number = ?,
             profile_complete = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(fullName, phone, department, studyYear, admissionNumber, id)
      .run();
    if ((result.meta?.changes ?? 0) !== 1) throw new MembershipError("Member not found.", 404);
    return json({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
};
