import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from "firebase/firestore";

// Read Firebase config dynamically from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  measurementId: import.meta.env.PUBLIC_MEASUREMENT_ID
};

// Singleton initialization pattern
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable persistent auth state across page reloads & sessions
setPersistence(auth, browserLocalPersistence).catch(console.error);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: "ajce.in",
  prompt: "select_account"
});

/**
 * Sign in with Google (@ajce.in email enforcement)
 */
export async function loginWithCollegeGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const email = result.user?.email || "";

    // Strictly validate domain
    if (!email.toLowerCase().endsWith("@ajce.in")) {
      await signOut(auth);
      throw new Error("Access Restricted: Please sign in with your official @ajce.in student email.");
    }

    return result.user;
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in cancelled. Please complete Google login to proceed.");
    }
    throw error;
  }
}

/**
 * Save membership registration directly to Firestore DB
 */
export async function submitMembershipToFirestore(user, submissionData) {
  if (!user || !user.uid) {
    throw new Error("User must be logged in to submit membership.");
  }

  const userDocRef = doc(db, "memberships", user.uid);

  const payload = {
    uid: user.uid,
    fullName: submissionData.fullName,
    course: submissionData.course,
    semester: submissionData.semester,
    department: submissionData.department,
    phone: submissionData.phone,
    email: user.email,
    txnId: submissionData.txnId,
    screenshotUrl: submissionData.screenshotUrl || "",
    status: "Pending Verification",
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(userDocRef, payload, { merge: true });
  return payload;
}

/**
 * Listen to live status updates from Firestore for logged-in user
 */
export function listenToUserMembership(uid, callback) {
  if (!uid) return () => {};
  const userDocRef = doc(db, "memberships", uid);
  return onSnapshot(userDocRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback(null);
    }
  }, (err) => {
    console.error("Firestore listener error:", err);
  });
}
