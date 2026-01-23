import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

export type RetailerMediaCategory = "saft" | "sylte_gele" | "frisk" | "rein" | "ol" | "sider";

export type RetailerMediaItem = {
    id: string;
    category: RetailerMediaCategory;
    productName: string;
    sizeLabel: string; // e.g. "0.7L", "195 ml"
    imageUrl: string;
    storagePath: string; // where in Storage
    fileName: string; // e.g. "eplesaft-07l-3000.png"
    active: boolean;
    createdAt?: any;
};

const COLL = "retailerMedia";

export async function listRetailerMedia(): Promise<RetailerMediaItem[]> {
    const snap = await getDocs(collection(db, COLL));
    const items: RetailerMediaItem[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
            id: d.id,
            category: data.category,
            productName: data.productName ?? "",
            sizeLabel: data.sizeLabel ?? "",
            imageUrl: data.imageUrl ?? "",
            storagePath: data.storagePath ?? "",
            fileName: data.fileName ?? "",
            active: data.active !== false,
            createdAt: data.createdAt,
        };
    });

    // Sort nicely: category -> productName -> sizeLabel
    items.sort((a, b) => {
        const c = a.category.localeCompare(b.category);
        if (c !== 0) return c;
        const p = a.productName.localeCompare(b.productName);
        if (p !== 0) return p;
        return a.sizeLabel.localeCompare(b.sizeLabel);
    });

    return items;
}

export async function uploadRetailerMedia(params: {
    category: RetailerMediaCategory;
    productName: string;
    sizeLabel: string;
    file: File;
}): Promise<string> {
    const storage = getStorage();
    const safe = (s: string) =>
        s
            .trim()
            .toLowerCase()
            .replaceAll(" ", "-")
            .replaceAll("æ", "ae")
            .replaceAll("ø", "o")
            .replaceAll("å", "a")
            .replaceAll("é", "e")
            .replaceAll("è", "e")
            .replaceAll(/[^\w\-\.]+/g, "");

    const ext = params.file.name.split(".").pop() || "png";
    const fileName = `${safe(params.productName)}-${safe(params.sizeLabel)}.${ext}`;

    // Storage path: retailer-media/<category>/<filename>
    const storagePath = `retailer-media/${params.category}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(
        storageRef,
        params.file,
        {
            contentType: params.file.type || undefined,
            customMetadata: {
                category: params.category,
                productName: params.productName,
                sizeLabel: params.sizeLabel,
            },
        } as any
    );

    const imageUrl = await getDownloadURL(storageRef);

    const docRef = await addDoc(collection(db, COLL), {
        category: params.category,
        productName: params.productName,
        sizeLabel: params.sizeLabel,
        imageUrl,
        storagePath,
        fileName,
        active: true,
        createdAt: serverTimestamp(),
    });

    return docRef.id;
}

export async function setRetailerMediaActive(id: string, active: boolean) {
    await updateDoc(doc(db, COLL, id), { active });
}

export async function deleteRetailerMedia(item: RetailerMediaItem) {
    // delete from Firestore
    await deleteDoc(doc(db, COLL, item.id));

    // delete from Storage (best-effort)
    try {
        const storage = getStorage();
        const storageRef = ref(storage, item.storagePath);
        await deleteObject(storageRef);
    } catch {
        // ignore if missing
    }
}