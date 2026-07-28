import type { APIRoute } from "astro";
import { getDatabase, json, MembershipError, requireAdmin, toApiError } from "../../../lib/membership";

export const prerender = false;

const asText = (value: unknown) => String(value ?? "").trim();

const asDate = (value: unknown) => {
  const input = asText(value);
  if (!input) return new Date().toISOString();
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new MembershipError("Recorded date must be valid.", 400);
  return date.toISOString();
};

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    await requireAdmin(request, locals);
    const database = getDatabase(locals);
    const [membership, adjustments, entries] = await database.batch([
      database.prepare(
        "SELECT COALESCE(SUM(amount_paise), 0) AS paise FROM payments WHERE status IN ('verified', 'captured')"
      ),
      database.prepare(
        `SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount_paise ELSE -amount_paise END), 0) AS paise
         FROM chapter_fund_entries`
      ),
      database.prepare(
        `SELECT chapter_fund_entries.*, users.full_name AS recorded_by_name
         FROM chapter_fund_entries
         LEFT JOIN users ON users.id = chapter_fund_entries.created_by
         ORDER BY recorded_at DESC, created_at DESC
         LIMIT 100`
      ),
    ]);
    const membershipPaise = Number(membership.results?.[0]?.paise ?? 0);
    const adjustmentPaise = Number(adjustments.results?.[0]?.paise ?? 0);
    return json({
      membershipPaise,
      adjustmentPaise,
      currentFundsPaise: membershipPaise + adjustmentPaise,
      entries: entries.results ?? [],
    });
  } catch (error) {
    return toApiError(error);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const admin = await requireAdmin(request, locals);
    const body = (await request.json()) as Record<string, unknown>;
    const title = asText(body.title);
    const category = asText(body.category);
    const notes = asText(body.notes);
    const entryType = asText(body.entryType);
    const amountPaise = Number(body.amountPaise);
    if (!title) throw new MembershipError("A fund entry title is required.", 400);
    if (entryType !== "credit" && entryType !== "debit") {
      throw new MembershipError("Fund entries must be income or expense.", 400);
    }
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      throw new MembershipError("Enter a valid amount greater than zero.", 400);
    }

    const entry = {
      id: crypto.randomUUID(),
      entryType,
      amountPaise,
      title,
      category: category || null,
      notes: notes || null,
      recordedAt: asDate(body.recordedAt),
      createdBy: admin.id,
    };
    await getDatabase(locals)
      .prepare(
        `INSERT INTO chapter_fund_entries
         (id, entry_type, amount_paise, title, category, notes, recorded_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.id,
        entry.entryType,
        entry.amountPaise,
        entry.title,
        entry.category,
        entry.notes,
        entry.recordedAt,
        entry.createdBy
      )
      .run();
    return json({ ok: true, entry }, 201);
  } catch (error) {
    return toApiError(error);
  }
};
