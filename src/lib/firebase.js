// Firebase configuration template for Google Auth (@ajce.in) & Firestore DB
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, doc, updateDoc, onSnapshot } from "firebase/firestore";

// Config placeholder - user can paste their Firebase project keys here
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "acm-ajce.firebaseapp.com",
  projectId: "acm-ajce",
  storageBucket: "acm-ajce.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Restrict Google Login exclusively to college domain (@ajce.in)
googleProvider.setCustomParameters({
  hd: "ajce.in"
});

/**
 * Sign in student with Google (@ajce.in required)
 */
export async function loginWithCollegeGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const email = result.user.email;

    if (!email || (!email.endsWith("@ajce.in") && !email.endsWith(".ajce.in"))) {
      await signOut(auth);
      throw new Error("Access Restricted: You must log in using your official college email ending with @ajce.in");
    }

    return result.user;
  } catch (error) {
    console.error("College Auth Error:", error);
    throw error;
  }
}
