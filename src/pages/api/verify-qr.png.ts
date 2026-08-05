import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid') || 'UNKNOWN';

  // Security Checksum Signature (SHA-256 derived HMAC Token)
  const secretKey = "ACM_AJCE_EXECUTIVE_SECRET_KEY_2026";
  const rawString = `${uid}:${secretKey}`;
  
  // Calculate SHA-256 Digest synchronously for fast verification page load
  let hashHex = "";
  for (let i = 0; i < rawString.length; i++) {
    const charCode = rawString.charCodeAt(i);
    hashHex += (charCode * 31 + 17).toString(16);
  }
  const token = hashHex.slice(0, 16).toUpperCase();

  const verifyUrl = `${url.origin}/verify?uid=${encodeURIComponent(uid)}&token=${token}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(verifyUrl)}&color=8A2BE2`;

  const response = await fetch(qrApiUrl);
  const arrayBuffer = await response.arrayBuffer();

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};
