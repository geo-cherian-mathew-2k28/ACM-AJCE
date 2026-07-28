import type { APIRoute } from "astro";
import { getDatabase, json, MembershipError, requireAdmin, toApiError } from "../../../../lib/membership";

export const prerender = false;

const asText = (value: unknown) => String(value ?? "").trim();

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const asDate = (value: unknown, label: string, required = false) => {
  const input = asText(value);
  if (!input && !required) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new MembershipError(`${label} must be a valid date.`, 400);
  return date.toISOString();
};

const eventValues = (body: Record<string, unknown>) => {
  const title = asText(body.title);
  const summary = asText(body.summary);
  const slug = toSlug(asText(body.slug) || title);
  if (!title || !summary || !slug) {
    throw new MembershipError("Event title and summary are required.", 400);
  }
  const capacityInput = asText(body.capacity);
  const capacity = capacityInput ? Number(capacityInput) : null;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    throw new MembershipError("Capacity must be a positive whole number.", 400);
  }

  return {
    title,
    slug,
    summary,
    details: asText(body.details) || null,
    venue: asText(body.venue) || null,
    startsAt: asDate(body.startsAt, "Start time", true),
    endsAt: asDate(body.endsAt, "End time"),
    registrationDeadline: asDate(body.registrationDeadline, "Registration deadline"),
    capacity,
    memberOnly: body.memberOnly === false || body.memberOnly === "false" ? 0 : 1,
    registrationOpen: body.registrationOpen === false || body.registrationOpen === "false" ? 0 : 1,
    published: body.published === true || body.published === "true" ? 1 : 0,
  };
};

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    await requireAdmin(request, locals);
    const events = await getDatabase(locals)
      .prepare("SELECT * FROM events ORDER BY starts_at DESC")
      .all();
    return json({ events: events.results ?? [] });
  } catch (error) {
    return toApiError(error);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const admin = await requireAdmin(request, locals);
    const values = eventValues((await request.json()) as Record<string, unknown>);
    const id = crypto.randomUUID();
    await getDatabase(locals)
      .prepare(
        `INSERT INTO events
         (id, title, slug, summary, details, venue, starts_at, ends_at,
          registration_deadline, capacity, member_only, registration_open, published, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        values.title,
        values.slug,
        values.summary,
        values.details,
        values.venue,
        values.startsAt,
        values.endsAt,
        values.registrationDeadline,
        values.capacity,
        values.memberOnly,
        values.registrationOpen,
        values.published,
        admin.id
      )
      .run();
    return json({ ok: true, id }, 201);
  } catch (error) {
    return toApiError(error);
  }
};
