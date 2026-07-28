import type { APIRoute } from "astro";
import {
  getDatabase,
  json,
  requireUser,
  toApiError,
} from "../../../lib/membership";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const user = await requireUser(request, locals);
    const body = (await request.json()) as Record<string, unknown>;
    const fullName = String(body.fullName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const department = String(body.department ?? "").trim();
    const studyYear = String(body.studyYear ?? "").trim();
    const admissionNumber = String(body.admissionNumber ?? "").trim();

    if (!fullName || !phone || !department || !studyYear || !admissionNumber) {
      return json({ message: "Please complete every membership profile field." }, 400);
    }
    if (!/^[0-9+()\s-]{7,20}$/.test(phone)) {
      return json({ message: "Enter a valid phone number." }, 400);
    }

    const database = getDatabase(locals);
    await database
      .prepare(
        `UPDATE users
         SET full_name = ?, phone = ?, department = ?, study_year = ?,
             admission_number = ?, profile_complete = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(fullName, phone, department, studyYear, admissionNumber, user.id)
      .run();

    return json({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
};
