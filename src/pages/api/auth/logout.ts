import type { APIRoute } from "astro";
import { clearSessionHeader } from "../../../lib/membership";

export const prerender = false;

export const POST: APIRoute = async ({ request }) =>
  new Response(null, {
    status: 302,
    headers: {
      location: "/membership",
      "set-cookie": clearSessionHeader(request),
      "cache-control": "no-store",
    },
  });
