import type { APIRoute } from "astro";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

export const prerender = false;

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || "AIzaSyA9y9ykBbvWMbvRs1PvoH_ITlgaLB96IQY",
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "acm-ajce-portal.firebaseapp.com",
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || "acm-ajce-portal",
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "acm-ajce-portal.firebasestorage.app",
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "657659504135",
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || "1:657659504135:web:26bf9f20986f24ed1c6ca2"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { firstName, lastName, email, phone, message } = data;

    if (!firstName || !email || !message) {
      return new Response(
        JSON.stringify({ message: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save contact message directly into Firestore collection `contacts`
    await addDoc(collection(db, "contacts"), {
      name: `${firstName} ${lastName || ""}`.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : "N/A",
      message: message.trim(),
      receivedAt: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ success: true, message: "Contact message saved to Firestore DB!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Firestore Contact POST Error:", error);
    return new Response(
      JSON.stringify({ message: error.message || "Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
