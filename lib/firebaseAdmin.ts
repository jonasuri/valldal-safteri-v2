import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

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
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
}

export function getAdminFirestore() {
    return getFirestore(getAdminApp());
}

export function getAdminAuth() {
    return getAuth(getAdminApp());
}

export function getAdminStorage() {
    return getStorage(getAdminApp());
}

export function getAdminStorageBucket() {
    const bucketName = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName || !/^[a-z0-9._-]+\.(appspot\.com|firebasestorage\.app)$/.test(bucketName)) {
        throw new Error("Firebase Storage manglar eit gyldig bøttenamn.");
    }
    return getAdminStorage().bucket(bucketName);
}
