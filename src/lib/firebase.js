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

// Read Firebase config dynamically with solid fallback constants
const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.PUBLIC_MEASUREMENT_ID || ""
};

// Singleton initialization pattern
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable persistent auth state across page reloads & sessions
setPersistence(auth, browserLocalPersistence).catch(console.error);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

/**
 * Sign in with Google (allows all Google logins for freshers/students)
 */
export async function loginWithCollegeGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
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
 * Determine Execom Officer Role & Access Permissions
 */
export function getExecomRole(user) {
  if (!user || !user.email) return null;
  const email = user.email.toLowerCase();
  
  // 1. Webmaster (Ultimate Admin with full edit/delete/approve powers)
  if (
    email === "geocherianmathew@gmail.com" ||
    email.includes("geocherianmathew") ||
    email === "webmaster@ajce.acm.org" ||
    email.startsWith("geocherian")
  ) {
    return {
      role: "webmaster",
      label: "Webmaster (Super Admin)",
      canEdit: true,
      canDelete: true,
      canApprove: true,
      name: user.displayName || "Geo Cherian Mathew"
    };
  }

  // 2. Treasurer (Restricted approval & rejection powers ONLY, zero edit/delete access)
  if (
    email === "sebinshaji295@gmail.com" ||
    email.includes("sebinshaji") ||
    email === "treasurer@ajce.acm.org" ||
    email.startsWith("sebin")
  ) {
    return {
      role: "treasurer",
      label: "Treasurer (Approval Access Only)",
      canEdit: false,
      canDelete: false,
      canApprove: true,
      name: user.displayName || "Sebin Shaji"
    };
  }

  return null;
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

/**
 * Listen to ALL memberships in real-time for the Execom Dashboard
 */
export function listenToAllMemberships(callback) {
  const membershipsCol = collection(db, "memberships");
  return onSnapshot(membershipsCol, (snapshot) => {
    const list = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort by submission date descending (newest first)
    list.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
    callback(list);
  }, (err) => {
    console.error("Firestore Execom listener error:", err);
  });
}

/**
 * Update Membership Status with Complete Audit Logging
 * (Allowed for Webmaster & Treasurer)
 */
export async function updateMembershipStatus(uid, newStatus, actor, note = "") {
  if (!uid || !newStatus || !actor) {
    throw new Error("Missing required parameters for status update.");
  }

  const userDocRef = doc(db, "memberships", uid);
  const docSnap = await getDoc(userDocRef);
  const existingData = docSnap.exists() ? docSnap.data() : {};

  const timestamp = new Date().toISOString();
  const existingHistory = Array.isArray(existingData.statusHistory) ? existingData.statusHistory : [];

  const historyEntry = {
    status: newStatus,
    updatedBy: actor.name || actor.email || "Execom Officer",
    updatedByEmail: actor.email || "",
    updatedByRole: actor.role === "treasurer" ? "Treasurer" : "Webmaster",
    timestamp: timestamp,
    note: note || ""
  };

  const payload = {
    status: newStatus,
    updatedAt: timestamp,
    lastUpdatedBy: actor.name || actor.email,
    lastUpdatedByEmail: actor.email,
    lastUpdatedByRole: actor.role === "treasurer" ? "Treasurer" : "Webmaster",
    statusHistory: [...existingHistory, historyEntry]
  };

  if (newStatus === "Verified") {
    payload.verifiedAt = existingData.verifiedAt || timestamp;
    payload.membershipId = existingData.membershipId || `ACM-AJCE-${uid.slice(0, 5).toUpperCase()}`;
  }

  await setDoc(userDocRef, payload, { merge: true });
  return payload;
}

/**
 * Update Membership Details (Webmaster Only)
 */
export async function updateMembershipDetails(uid, updatedFields, actor) {
  if (!uid || !actor || actor.role !== "webmaster") {
    throw new Error("Unauthorized: Only the Webmaster can edit membership records.");
  }

  const userDocRef = doc(db, "memberships", uid);
  const timestamp = new Date().toISOString();

  const payload = {
    fullName: updatedFields.fullName,
    course: updatedFields.course,
    semester: updatedFields.semester,
    department: updatedFields.department,
    phone: updatedFields.phone,
    txnId: updatedFields.txnId,
    updatedAt: timestamp,
    lastEditedBy: actor.name || actor.email,
    lastEditedAt: timestamp
  };

  await setDoc(userDocRef, payload, { merge: true });
  return payload;
}

/**
 * Delete Membership Record (Webmaster Only)
 */
export async function deleteMembershipRecord(uid, actor) {
  if (!uid || !actor || actor.role !== "webmaster") {
    throw new Error("Unauthorized: Only the Webmaster can delete membership records.");
  }
  const { deleteDoc } = await import("firebase/firestore");
  const userDocRef = doc(db, "memberships", uid);
  await deleteDoc(userDocRef);
  return true;
}
