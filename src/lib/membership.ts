export const MEMBERSHIP_PRICE_PAISE = 15_000;
export const MEMBERSHIP_PRICE_LABEL = "Rs. 150";
export const MEMBERSHIP_PLAN = "local-annual";

type RuntimeEnv = Record<string, any>;
type Database = any;

export type MemberUser = {
  id: string;
  google_sub: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: "member" | "admin";
  phone: string | null;
  department: string | null;
  study_year: string | null;
  admission_number: string | null;
  profile_complete: number;
  created_at: string;
  updated_at: string;
};

export type MembershipRecord = {
  id: string;
  user_id: string;
  member_number: string;
  plan_code: string;
  amount_paise: number;
  status: "pending" | "active" | "expired" | "cancelled";
  starts_at: string;
  expires_at: string;
  payment_id: string | null;
};

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

export class MembershipError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

const encoder = new TextEncoder();
const SESSION_COOKIE = "acm_ajce_session";
const OAUTH_STATE_COOKIE = "acm_ajce_oauth_state";

export const getRuntimeEnv = (locals: any): RuntimeEnv =>
  (locals?.runtime?.env ?? {}) as RuntimeEnv;

export const getDatabase = (locals: any): Database => {
  const database = getRuntimeEnv(locals).MEMBERSHIP_DB;
  if (!database) {
    throw new MembershipError(
      "Membership database is not configured. Add the MEMBERSHIP_DB D1 binding first.",
      503
    );
  }
  return database;
};

export const getRequiredSecret = (locals: any, name: string) => {
  const value = getRuntimeEnv(locals)[name];
  if (!value || typeof value !== "string") {
    throw new MembershipError(`Missing required server secret: ${name}.`, 503);
  }
  return value;
};

export const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

export const toApiError = (error: unknown) => {
  if (error instanceof MembershipError) {
    return json({ message: error.message }, error.status);
  }
  console.error("Membership API error", error);
  return json({ message: "Unable to complete this membership request." }, 500);
};

const parseCookies = (request: Request) => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return Object.fromEntries(cookieHeader.split(";").map((entry) => {
    const separator = entry.indexOf("=");
    const key = separator >= 0 ? entry.slice(0, separator).trim() : entry.trim();
    const value = separator >= 0 ? entry.slice(separator + 1) : "";
    return [key, decodeURIComponent(value)];
  }).filter(([key]) => key));
};

const toBase64Url = (value: string) =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(String.fromCharCode(...bytes));
};

export const hmacHex = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const isSecureRequest = (request: Request) =>
  new URL(request.url).protocol === "https:";

const cookie = (
  request: Request,
  name: string,
  value: string,
  maxAge?: number
) => {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isSecureRequest(request) ? "Secure" : "",
    typeof maxAge === "number" ? `Max-Age=${maxAge}` : "",
  ].filter(Boolean);
  return attributes.join("; ");
};

const safeEqual = (left: string, right: string) => {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
};

export const verifyHmacHex = async (
  value: string,
  signature: string,
  secret: string
) => safeEqual(signature, await hmacHex(value, secret));

export const createSession = async (userId: string, secret: string) => {
  const payload: SessionPayload = {
    userId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await hmacHex(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
};

const readSession = async (request: Request, locals: any) => {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  try {
    const secret = getRequiredSecret(locals, "MEMBERSHIP_SESSION_SECRET");
    const expectedSignature = await hmacHex(encodedPayload, secret);
    if (!safeEqual(signature, expectedSignature)) return null;
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    return payload.expiresAt > Date.now() ? payload : null;
  } catch {
    return null;
  }
};

export const sessionHeader = (request: Request, token: string) =>
  cookie(request, SESSION_COOKIE, token, 60 * 60 * 24 * 14);

export const clearSessionHeader = (request: Request) =>
  cookie(request, SESSION_COOKIE, "", 0);

export const oauthStateHeader = (request: Request, state: string) =>
  cookie(request, OAUTH_STATE_COOKIE, state, 60 * 10);

export const clearOauthStateHeader = (request: Request) =>
  cookie(request, OAUTH_STATE_COOKIE, "", 0);

export const readOauthState = (request: Request) =>
  parseCookies(request)[OAUTH_STATE_COOKIE] ?? "";

export const createOauthState = () => randomToken();

export const getAdminEmails = (locals: any) =>
  new Set(
    String(getRuntimeEnv(locals).ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

export const isAdminEmail = (email: string, locals: any) =>
  getAdminEmails(locals).has(email.toLowerCase());

export const getCurrentUser = async (request: Request, locals: any) => {
  const session = await readSession(request, locals);
  if (!session) return null;
  const database = getDatabase(locals);
  const user = await database
    .prepare("SELECT * FROM users WHERE id = ? LIMIT 1")
    .bind(session.userId)
    .first<MemberUser>();
  return user ?? null;
};

export const requireUser = async (request: Request, locals: any) => {
  const user = await getCurrentUser(request, locals);
  if (!user) throw new MembershipError("Please sign in to continue.", 401);
  return user;
};

export const requireAdmin = async (request: Request, locals: any) => {
  const user = await requireUser(request, locals);
  if (!isAdminEmail(user.email, locals)) {
    throw new MembershipError("You do not have permission to access this area.", 403);
  }
  return user;
};

export const getActiveMembership = async (database: Database, userId: string) =>
  database
    .prepare(
      `SELECT * FROM memberships
       WHERE user_id = ? AND status = 'active' AND expires_at > ?
       ORDER BY expires_at DESC LIMIT 1`
    )
    .bind(userId, new Date().toISOString())
    .first<MembershipRecord>();

export const createMemberNumber = () => {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `AJCE-ACM-${year}-${suffix}`;
};

export const addOneYear = (date = new Date()) => {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + 1);
  return next.toISOString();
};

export const activateMembership = async (
  database: Database,
  userId: string,
  paymentId: string
) => {
  const active = await getActiveMembership(database, userId);
  if (active) return active;

  const membership: MembershipRecord = {
    id: crypto.randomUUID(),
    user_id: userId,
    member_number: createMemberNumber(),
    plan_code: MEMBERSHIP_PLAN,
    amount_paise: MEMBERSHIP_PRICE_PAISE,
    status: "active",
    starts_at: new Date().toISOString(),
    expires_at: addOneYear(),
    payment_id: paymentId,
  };

  try {
    await database
      .prepare(
        `INSERT INTO memberships
         (id, user_id, member_number, plan_code, amount_paise, status, starts_at, expires_at, payment_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        membership.id,
        membership.user_id,
        membership.member_number,
        membership.plan_code,
        membership.amount_paise,
        membership.status,
        membership.starts_at,
        membership.expires_at,
        membership.payment_id
      )
      .run();
  } catch (error) {
    const concurrentMembership = await getActiveMembership(database, userId);
    if (concurrentMembership) return concurrentMembership;
    throw error;
  }

  return membership;
};

export const hashCoupon = (code: string, locals: any) =>
  hmacHex(
    code.trim().toUpperCase(),
    getRequiredSecret(locals, "COUPON_HASH_SECRET")
  );

export const createCouponCode = () =>
  `AJCE-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

export const createRazorpayOrder = async (
  locals: any,
  options: { receipt: string; userId: string }
) => {
  const keyId = getRequiredSecret(locals, "RAZORPAY_KEY_ID");
  const keySecret = getRequiredSecret(locals, "RAZORPAY_KEY_SECRET");
  const authorization = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: MEMBERSHIP_PRICE_PAISE,
      currency: "INR",
      receipt: options.receipt,
      notes: {
        product: "ACM AJCE Local Chapter Annual Membership",
        member_reference: options.userId,
      },
    }),
  });

  if (!response.ok) {
    console.error("Razorpay order creation failed", await response.text());
    throw new MembershipError("Unable to start the payment right now.", 502);
  }

  return {
    keyId,
    order: (await response.json()) as { id: string; amount: number; currency: string },
  };
};
