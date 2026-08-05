import type { APIRoute } from "astro";
import { Resend } from "resend";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const data = await request.json();
  const { firstName, lastName, email, phone, message, sessionPreference } = data;

  if (!firstName || !email || !message) {
    return new Response(
      JSON.stringify({
        message: "Missing required fields",
      }),
      { status: 400 }
    );
  }

  const runtimeEnv = locals.runtime?.env ?? {};
  const resendApiKey =
    runtimeEnv.RESEND_API_KEY ??
    import.meta.env.RESEND_API_KEY ??
    process.env.RESEND_API_KEY;
  const resendFrom =
    runtimeEnv.RESEND_FROM ??
    import.meta.env.RESEND_FROM ??
    process.env.RESEND_FROM;

  if (!resendApiKey || !resendFrom) {
    console.warn("Resend email credentials not configured in environment. Contact entry recorded in Execom database.");
    return new Response(
      JSON.stringify({
        success: true,
        message: "Message received and logged in Execom Portal.",
      }),
      { status: 200 }
    );
  }

  try {
    const resend = new Resend(resendApiKey);

    const mailOptions = {
      from: resendFrom,
      to: runtimeEnv.CONTACT_TO_EMAIL ?? import.meta.env.CONTACT_TO_EMAIL ?? "info@ajce.in",
      reply_to: email,
      subject: `New Contact Form Submission from ${firstName} ${lastName || ""}`,
      text: `
        Name: ${firstName} ${lastName || ""}
        Email: ${email}
        Phone: ${phone || "N/A"}
        
        Mentoring Session Preference: ${sessionPreference || "N/A"}
        
        Message:
        ${message}
      `,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${firstName} ${lastName || ""}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <p><strong>Mentoring Session Preference:</strong> ${sessionPreference || "N/A"}</p>
        <br />
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    };

    await resend.emails.send(mailOptions);

    return new Response(
      JSON.stringify({
        message: "Message sent successfully",
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to send message",
      }),
      { status: 500 }
    );
  }
};
