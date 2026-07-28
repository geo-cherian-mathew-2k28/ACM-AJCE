import type { APIRoute } from "astro";
import { getDatabase, json, MembershipError, requireAdmin, toApiError } from "../../../../lib/membership";

export const prerender = false;

const asText = (value: unknown) => String(value ?? "").trim();

const toSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

const toIso = (value: unknown, label: string, required = false) => {
  const input = asText(value);
  if (!input && !required) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new MembershipError(`${label} must be a valid date.`, 400);
  return date.toISOString();
};

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  try {
    await requireAdmin(request, locals);
    const id = params.id;
    if (!id) throw new MembershipError("Event not found.", 404);
    const database = getDatabase(locals);
    const current = await database.prepare("SELECT * FROM events WHERE id = ? LIMIT 1").bind(id).first<any>();
    if (!current) throw new MembershipError("Event not found.", 404);
    const body = (await request.json()) as Record<string, unknown>;
    const title = asText(body.title ?? current.title);
    const summary = asText(body.summary ?? current.summary);
    const slug = toSlug(asText(body.slug ?? current.slug) || title);
    const capacityRaw = body.capacity ?? current.capacity;
    const capacityText = asText(capacityRaw);
    const capacity = capacityText ? Number(capacityText) : null;
    if (!title || !summary || !slug) throw new MembershipError("Event title and summary are required.", 400);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      throw new MembershipError("Capacity must be a positive whole number.", 400);
    }

    await database
      .prepare(
        `UPDATE events
         SET title = ?, slug = ?, summary = ?, details = ?, venue = ?, starts_at = ?, ends_at = ?,
             registration_deadline = ?, capacity = ?, member_only = ?, registration_open = ?,
             published = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        title,
        slug,
        summary,
        asText(body.details ?? current.details) || null,
        asText(body.venue ?? current.venue) || null,
        toIso(body.startsAt ?? current.starts_at, "Start time", true),
        toIso(body.endsAt ?? current.ends_at, "End time"),
        toIso(body.registrationDeadline ?? current.registration_deadline, "Registration deadline"),
        capacity,
        body.memberOnly === undefined ? current.member_only : (body.memberOnly === false || body.memberOnly === "false" ? 0 : 1),
        body.registrationOpen === undefined ? current.registration_open : (body.registrationOpen === false || body.registrationOpen === "false" ? 0 : 1),
        body.published === undefined ? current.published : (body.published === true || body.published === "true" ? 1 : 0),
        id
      )
      .run();
    return json({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
};

export const DELETE: APIRoute = async ({ request, params, locals }) => {
  try {
    await requireAdmin(request, locals);
    const id = params.id;
    if (!id) throw new MembershipError("Event not found.", 404);
    await getDatabase(locals).prepare("DELETE FROM events WHERE id = ?").bind(id).run();
    return new Response(null, { status: 204 });
  } catch (error) {
    return toApiError(error);
  }
};
