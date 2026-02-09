import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { connectFirestoreEmulator } from "firebase/firestore";
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "asia-northeast1";
export const functions = getFunctions(app, region);

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    connectFunctionsEmulator(functions, window.location.hostname, 5001);
}

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    const host = window.location.hostname;

    try {
        connectFunctionsEmulator(functions, host, 5001);
    } catch { }

    try {
        connectFirestoreEmulator(db, host, 8080);
    } catch { }
}