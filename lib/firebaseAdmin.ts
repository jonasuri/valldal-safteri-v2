import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function privateKey() {
    return process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function getAdminApp() {
    if (getApps().length) return getApps()[0];

    const projectId =
        process.env.FIREBASE_ADMIN_PROJECT_ID ??
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const key = privateKey();

    if (!projectId || !clientEmail || !key) {
        throw new Error(
            "Firebase Admin manglar miljøvariablane FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL og FIREBASE_ADMIN_PRIVATE_KEY."
        );
    }

    return initializeApp({
        credential: cert({ projectId, clientEmail, privateKey: key }),
        projectId,
    });
}

export function getAdminFirestore() {
    return getFirestore(getAdminApp());
}
