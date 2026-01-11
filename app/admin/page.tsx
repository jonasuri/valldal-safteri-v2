"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    type User,
} from "firebase/auth";
import { db, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";

type DayKey =
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";

type OpeningHours = Record<DayKey, { from: string; to: string }>;

type Outlet = {
    id: string;
    name: string;
    place: string;
    kind: string;
    address: string;
    links: OutletLink[];
    hasSafteri: boolean;
    hasBryggeri: boolean;
    lat?: number | null;
    lng?: number | null;
};

type OutletLink = {
    label: string;
    url: string;
};

const dayOrder: DayKey[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
];

const dayLabels: Record<DayKey, string> = {
    monday: "Måndag",
    tuesday: "Tysdag",
    wednesday: "Onsdag",
    thursday: "Torsdag",
    friday: "Fredag",
    saturday: "Laurdag",
    sunday: "Søndag",
};

const defaultOpeningHours: OpeningHours = {
    monday: { from: "", to: "" },
    tuesday: { from: "", to: "" },
    wednesday: { from: "", to: "" },
    thursday: { from: "", to: "" },
    friday: { from: "", to: "" },
    saturday: { from: "", to: "" },
    sunday: { from: "", to: "" },
};

export default function AdminPage() {
    const [user, setUser] = useState<User | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [openingSeason, setOpeningSeason] = useState("");
    const [openingHours, setOpeningHours] = useState<OpeningHours>(defaultOpeningHours);
    const [openingNote, setOpeningNote] = useState("");

    const [contactAddress, setContactAddress] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [contactEmail, setContactEmail] = useState("");

    const [landingVisitIntro, setLandingVisitIntro] = useState("");
    const [landingAboutText, setLandingAboutText] = useState("");

    const [landingHeroKicker, setLandingHeroKicker] = useState("");
    const [landingHeroTitle, setLandingHeroTitle] = useState("");
    const [landingHeroSubtitle, setLandingHeroSubtitle] = useState("");
    const [landingSafteriDescription, setLandingSafteriDescription] = useState("");
    const [landingBryggeriDescription, setLandingBryggeriDescription] = useState("");
    const [landingHeroImages, setLandingHeroImages] = useState<string[]>([]);
    const [landingHeroWords, setLandingHeroWords] = useState<string[]>(["", "", ""]);
    const [heroUploadError, setHeroUploadError] = useState<string | null>(null);
    const [heroUploading, setHeroUploading] = useState(false);

    const [safteriHeroKicker, setSafteriHeroKicker] = useState("");
    const [safteriHeroTitle, setSafteriHeroTitle] = useState("");
    const [safteriHeroSubtitle, setSafteriHeroSubtitle] = useState("");
    const [safteriHeroWords, setSafteriHeroWords] = useState<string[]>(["", "", ""]);

    const [bryggeriHeroKicker, setBryggeriHeroKicker] = useState("");
    const [bryggeriHeroTitle, setBryggeriHeroTitle] = useState("");
    const [bryggeriHeroSubtitle, setBryggeriHeroSubtitle] = useState("");
    const [bryggeriHeroWords, setBryggeriHeroWords] = useState<string[]>(["", "", ""]);

    const [bryggeriKortTitle, setBryggeriKortTitle] = useState("");
    const [bryggeriKortBullets, setBryggeriKortBullets] = useState<string[]>(["", "", ""]);

    const [bryggeriOlDescription, setBryggeriOlDescription] = useState("");
    const [bryggeriSiderDescription, setBryggeriSiderDescription] = useState("");

    const [bryggeriVisitText, setBryggeriVisitText] = useState("");
    const [bryggeriStoreText, setBryggeriStoreText] = useState("");
    const [bryggeriAboutText, setBryggeriAboutText] = useState("");

    const [safteriKortTitle, setSafteriKortTitle] = useState("");
    const [safteriKortBullets, setSafteriKortBullets] = useState<string[]>(["", "", ""]);

    const [safteriVisitIntro, setSafteriVisitIntro] = useState("");
    const [safteriVisitDetails, setSafteriVisitDetails] = useState("");

    const [safteriSaftDescription, setSafteriSaftDescription] = useState("");
    const [safteriSylteDescription, setSafteriSylteDescription] = useState("");
    const [safteriFriskDescription, setSafteriFriskDescription] = useState("");
    const [safteriReinDescription, setSafteriReinDescription] = useState("");
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [initialOutlets, setInitialOutlets] = useState<Outlet[]>([]);

    const [newOutletId, setNewOutletId] = useState<string | null>(null);
    const [outletSearchTerm, setOutletSearchTerm] = useState("");
    const [geoLoadingId, setGeoLoadingId] = useState<string | null>(null);
    const [geoErrorById, setGeoErrorById] = useState<Record<string, string | null>>({});
    const [geoSuccessById, setGeoSuccessById] = useState<Record<string, boolean>>({});

    const [initialOpeningSeason, setInitialOpeningSeason] = useState("");
    const [initialOpeningHours, setInitialOpeningHours] = useState<OpeningHours>(defaultOpeningHours);
    const [initialOpeningNote, setInitialOpeningNote] = useState("");
    const [initialContactAddress, setInitialContactAddress] = useState("");
    const [initialContactPhone, setInitialContactPhone] = useState("");
    const [initialContactEmail, setInitialContactEmail] = useState("");

    const [initialLandingHeroKicker, setInitialLandingHeroKicker] = useState("");
    const [initialLandingHeroTitle, setInitialLandingHeroTitle] = useState("");
    const [initialLandingHeroSubtitle, setInitialLandingHeroSubtitle] = useState("");
    const [initialLandingSafteriDescription, setInitialLandingSafteriDescription] = useState("");
    const [initialLandingBryggeriDescription, setInitialLandingBryggeriDescription] = useState("");
    const [initialLandingHeroImages, setInitialLandingHeroImages] = useState<string[]>([]);
    const [initialLandingHeroWords, setInitialLandingHeroWords] = useState<string[]>(["", "", ""]);

    const [initialLandingVisitIntro, setInitialLandingVisitIntro] = useState("");
    const [initialLandingAboutText, setInitialLandingAboutText] = useState("");
    const [initialSafteriVisitDetails, setInitialSafteriVisitDetails] = useState("");

    const [initialSafteriHeroKicker, setInitialSafteriHeroKicker] = useState("");
    const [initialSafteriHeroTitle, setInitialSafteriHeroTitle] = useState("");
    const [initialSafteriHeroSubtitle, setInitialSafteriHeroSubtitle] = useState("");
    const [initialSafteriHeroWords, setInitialSafteriHeroWords] = useState<string[]>(["", "", ""]);

    const [initialBryggeriHeroKicker, setInitialBryggeriHeroKicker] = useState("");
    const [initialBryggeriHeroTitle, setInitialBryggeriHeroTitle] = useState("");
    const [initialBryggeriHeroSubtitle, setInitialBryggeriHeroSubtitle] = useState("");
    const [initialBryggeriHeroWords, setInitialBryggeriHeroWords] = useState<string[]>(["", "", ""]);

    const [initialBryggeriKortTitle, setInitialBryggeriKortTitle] = useState("");
    const [initialBryggeriKortBullets, setInitialBryggeriKortBullets] =
        useState<string[]>(["", "", ""]);

    const [initialBryggeriOlDescription, setInitialBryggeriOlDescription] = useState("");
    const [initialBryggeriSiderDescription, setInitialBryggeriSiderDescription] = useState("");

    const [initialBryggeriVisitText, setInitialBryggeriVisitText] = useState("");
    const [initialBryggeriStoreText, setInitialBryggeriStoreText] = useState("");
    const [initialBryggeriAboutText, setInitialBryggeriAboutText] = useState("");

    const [initialSafteriKortTitle, setInitialSafteriKortTitle] = useState("");
    const [initialSafteriKortBullets, setInitialSafteriKortBullets] =
        useState<string[]>(["", "", ""]);

    const [initialSafteriVisitIntro, setInitialSafteriVisitIntro] = useState("");

    const [safteriAboutText, setSafteriAboutText] = useState("");
    const [initialSafteriAboutText, setInitialSafteriAboutText] = useState("");

    const [initialSafteriSaftDescription, setInitialSafteriSaftDescription] = useState("");
    const [initialSafteriSylteDescription, setInitialSafteriSylteDescription] = useState("");
    const [initialSafteriFriskDescription, setInitialSafteriFriskDescription] = useState("");
    const [initialSafteriReinDescription, setInitialSafteriReinDescription] = useState("");

    const [saving, setSaving] = useState(false);
    const [contentLoaded, setContentLoaded] = useState(false);
    const [lastSavedSection, setLastSavedSection] =
        useState<"opening" | "contact" | "landingHero" | "safteriHero" | "bryggeriHero" | "outlets" | null>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (current) => {
            setUser(current);
            setCheckingAuth(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) return;

        const loadContent = async () => {
            try {
                const ref = doc(db, "content", "global");
                const snap = await getDoc(ref);
                if (!snap.exists()) {
                    setContentLoaded(true);
                    return;
                }

                const data = snap.data() as any;

                let loadedSeason = "";
                let loadedHours: OpeningHours = defaultOpeningHours;
                let loadedNote = "";
                let loadedAddress = "";
                let loadedPhone = "";
                let loadedEmail = "";
                let loadedOutlets: Outlet[] = [];

                if (typeof data.openingSeason === "string") {
                    loadedSeason = data.openingSeason;
                    setOpeningSeason(loadedSeason);
                }

                if (data.openingHours && typeof data.openingHours === "object") {
                    loadedHours = { ...defaultOpeningHours };
                    for (const day of dayOrder) {
                        const dayData = data.openingHours[day];
                        if (dayData && typeof dayData === "object") {
                            loadedHours[day] = {
                                from: dayData.from ?? "",
                                to: dayData.to ?? "",
                            };
                        }
                    }
                    setOpeningHours(loadedHours);
                }

                if (typeof data.openingNote === "string") {
                    loadedNote = data.openingNote;
                    setOpeningNote(loadedNote);
                }

                if (typeof data.contactAddress === "string") {
                    loadedAddress = data.contactAddress;
                    setContactAddress(loadedAddress);
                }

                if (typeof data.contactPhone === "string") {
                    loadedPhone = data.contactPhone;
                    setContactPhone(loadedPhone);
                }

                if (typeof data.contactEmail === "string") {
                    loadedEmail = data.contactEmail;
                    setContactEmail(loadedEmail);
                }

                let loadedHeroKicker = "";
                let loadedHeroTitle = "";
                let loadedHeroSubtitle = "";
                let loadedSafteriDescription = "";
                let loadedBryggeriDescription = "";
                let loadedHeroImages: string[] = [];
                let loadedHeroWords: string[] = ["", "", ""];

                let loadedVisitIntro = "";
                let loadedAboutText = "";

                let loadedSafteriHeroKicker = "";
                let loadedSafteriHeroTitle = "";
                let loadedSafteriHeroSubtitle = "";
                let loadedSafteriHeroWords: string[] = ["", "", ""];

                let loadedBryggeriHeroKicker = "";
                let loadedBryggeriHeroTitle = "";
                let loadedBryggeriHeroSubtitle = "";
                let loadedBryggeriHeroWords: string[] = ["", "", ""];

                let loadedBryggeriKortTitle = "";
                let loadedBryggeriKortBullets: string[] = ["", "", ""];

                let loadedBryggeriOlDescription = "";
                let loadedBryggeriSiderDescription = "";

                let loadedBryggeriVisitText = "";

                let loadedBryggeriStoreText = "";
                let loadedBryggeriAboutText = "";

                let loadedSafteriKortTitle = "";
                let loadedSafteriKortBullets: string[] = ["", "", ""];
                let loadedSafteriVisitIntro = "";
                let loadedSafteriVisitDetails = "";
                let loadedSafteriAboutText = "";
                let loadedSafteriSaftDescription = "";
                let loadedSafteriSylteDescription = "";
                let loadedSafteriFriskDescription = "";
                let loadedSafteriReinDescription = "";

                if (typeof data.landingHeroKicker === "string") {
                    loadedHeroKicker = data.landingHeroKicker;
                    setLandingHeroKicker(loadedHeroKicker);
                }

                if (typeof data.landingHeroTitle === "string") {
                    loadedHeroTitle = data.landingHeroTitle;
                    setLandingHeroTitle(loadedHeroTitle);
                }

                if (typeof data.landingHeroSubtitle === "string") {
                    loadedHeroSubtitle = data.landingHeroSubtitle;
                    setLandingHeroSubtitle(loadedHeroSubtitle);
                }

                if (typeof data.landingSafteriDescription === "string") {
                    loadedSafteriDescription = data.landingSafteriDescription;
                    setLandingSafteriDescription(loadedSafteriDescription);
                }

                if (typeof data.landingBryggeriDescription === "string") {
                    loadedBryggeriDescription = data.landingBryggeriDescription;
                    setLandingBryggeriDescription(loadedBryggeriDescription);
                }

                if (Array.isArray(data.landingHeroImages)) {
                    loadedHeroImages = data.landingHeroImages.filter((v: unknown) => typeof v === "string");
                    setLandingHeroImages(loadedHeroImages);
                }

                if (Array.isArray(data.landingHeroWords)) {
                    loadedHeroWords = data.landingHeroWords.filter((v: unknown) => typeof v === "string");
                    while (loadedHeroWords.length < 3) {
                        loadedHeroWords.push("");
                    }
                    if (loadedHeroWords.length > 3) {
                        loadedHeroWords = loadedHeroWords.slice(0, 3);
                    }
                    setLandingHeroWords(loadedHeroWords);
                }

                if (typeof data.landingVisitIntro === "string") {
                    loadedVisitIntro = data.landingVisitIntro;
                    setLandingVisitIntro(loadedVisitIntro);
                }

                if (typeof data.landingAboutText === "string") {
                    loadedAboutText = data.landingAboutText;
                    setLandingAboutText(loadedAboutText);
                }

                if (typeof data.safteriHeroKicker === "string") {
                    loadedSafteriHeroKicker = data.safteriHeroKicker;
                    setSafteriHeroKicker(loadedSafteriHeroKicker);
                }

                if (typeof data.safteriHeroTitle === "string") {
                    loadedSafteriHeroTitle = data.safteriHeroTitle;
                    setSafteriHeroTitle(loadedSafteriHeroTitle);
                }

                if (typeof data.safteriHeroSubtitle === "string") {
                    loadedSafteriHeroSubtitle = data.safteriHeroSubtitle;
                    setSafteriHeroSubtitle(loadedSafteriHeroSubtitle);
                }

                if (Array.isArray(data.safteriHeroWords)) {
                    loadedSafteriHeroWords = data.safteriHeroWords.filter((v: unknown) => typeof v === "string");
                    while (loadedSafteriHeroWords.length < 3) {
                        loadedSafteriHeroWords.push("");
                    }
                    if (loadedSafteriHeroWords.length > 3) {
                        loadedSafteriHeroWords = loadedSafteriHeroWords.slice(0, 3);
                    }
                    setSafteriHeroWords(loadedSafteriHeroWords);
                }

                if (typeof data.bryggeriHeroKicker === "string") {
                    loadedBryggeriHeroKicker = data.bryggeriHeroKicker;
                    setBryggeriHeroKicker(loadedBryggeriHeroKicker);
                }

                if (typeof data.bryggeriHeroTitle === "string") {
                    loadedBryggeriHeroTitle = data.bryggeriHeroTitle;
                    setBryggeriHeroTitle(loadedBryggeriHeroTitle);
                }

                if (typeof data.bryggeriHeroSubtitle === "string") {
                    loadedBryggeriHeroSubtitle = data.bryggeriHeroSubtitle;
                    setBryggeriHeroSubtitle(loadedBryggeriHeroSubtitle);
                }

                if (Array.isArray(data.bryggeriHeroWords)) {
                    loadedBryggeriHeroWords = data.bryggeriHeroWords.filter((v: unknown) => typeof v === "string");
                    while (loadedBryggeriHeroWords.length < 3) {
                        loadedBryggeriHeroWords.push("");
                    }
                    if (loadedBryggeriHeroWords.length > 3) {
                        loadedBryggeriHeroWords = loadedBryggeriHeroWords.slice(0, 3);
                    }
                    setBryggeriHeroWords(loadedBryggeriHeroWords);
                }

                if (typeof data.bryggeriKortTitle === "string") {
                    loadedBryggeriKortTitle = data.bryggeriKortTitle;
                    setBryggeriKortTitle(loadedBryggeriKortTitle);
                }

                if (Array.isArray(data.bryggeriKortBullets)) {
                    loadedBryggeriKortBullets = data.bryggeriKortBullets.filter((v: unknown) => typeof v === "string");
                    while (loadedBryggeriKortBullets.length < 3) {
                        loadedBryggeriKortBullets.push("");
                    }
                    if (loadedBryggeriKortBullets.length > 3) {
                        loadedBryggeriKortBullets = loadedBryggeriKortBullets.slice(0, 3);
                    }
                    setBryggeriKortBullets(loadedBryggeriKortBullets);
                }

                if (typeof data.bryggeriOlDescription === "string") {
                    loadedBryggeriOlDescription = data.bryggeriOlDescription;
                    setBryggeriOlDescription(loadedBryggeriOlDescription);
                }

                if (typeof data.bryggeriSiderDescription === "string") {
                    loadedBryggeriSiderDescription = data.bryggeriSiderDescription;
                    setBryggeriSiderDescription(loadedBryggeriSiderDescription);
                }

                if (typeof data.bryggeriVisitText === "string") {
                    loadedBryggeriVisitText = data.bryggeriVisitText;
                    setBryggeriVisitText(loadedBryggeriVisitText);
                }

                if (typeof data.bryggeriStoreText === "string") {
                    loadedBryggeriStoreText = data.bryggeriStoreText;
                    setBryggeriStoreText(loadedBryggeriStoreText);
                }

                if (typeof data.safteriKortTitle === "string") {
                    loadedSafteriKortTitle = data.safteriKortTitle;
                    setSafteriKortTitle(loadedSafteriKortTitle);
                }

                if (typeof data.bryggeriAboutText === "string") {
                    loadedBryggeriAboutText = data.bryggeriAboutText;
                    setBryggeriAboutText(loadedBryggeriAboutText);
                }

                if (Array.isArray(data.safteriKortBullets)) {
                    loadedSafteriKortBullets = data.safteriKortBullets.filter((v: unknown) => typeof v === "string");
                    while (loadedSafteriKortBullets.length < 3) {
                        loadedSafteriKortBullets.push("");
                    }
                    if (loadedSafteriKortBullets.length > 3) {
                        loadedSafteriKortBullets = loadedSafteriKortBullets.slice(0, 3);
                    }
                    setSafteriKortBullets(loadedSafteriKortBullets);
                }
                if (typeof data.safteriVisitIntro === "string") {
                    loadedSafteriVisitIntro = data.safteriVisitIntro;
                    setSafteriVisitIntro(loadedSafteriVisitIntro);
                }

                if (typeof data.safteriVisitDetails === "string") {
                    loadedSafteriVisitDetails = data.safteriVisitDetails;
                    setSafteriVisitDetails(loadedSafteriVisitDetails);
                }

                if (typeof data.safteriAboutText === "string") {
                    loadedSafteriAboutText = data.safteriAboutText;
                    setSafteriAboutText(loadedSafteriAboutText);
                }

                if (typeof data.safteriSaftDescription === "string") {
                    loadedSafteriSaftDescription = data.safteriSaftDescription;
                    setSafteriSaftDescription(loadedSafteriSaftDescription);
                }

                if (typeof data.safteriSylteDescription === "string") {
                    loadedSafteriSylteDescription = data.safteriSylteDescription;
                    setSafteriSylteDescription(loadedSafteriSylteDescription);
                }

                if (typeof data.safteriFriskDescription === "string") {
                    loadedSafteriFriskDescription = data.safteriFriskDescription;
                    setSafteriFriskDescription(loadedSafteriFriskDescription);
                }

                if (typeof data.safteriReinDescription === "string") {
                    loadedSafteriReinDescription = data.safteriReinDescription;
                    setSafteriReinDescription(loadedSafteriReinDescription);
                }

                if (Array.isArray(data.outlets)) {
                    loadedOutlets = data.outlets
                        .map((item: any) => {
                            if (!item || typeof item !== "object") return null;

                            const idBase =
                                typeof item.id === "string" && item.id.trim()
                                    ? item.id
                                    : `outlet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

                            let links: OutletLink[] = [];
                            if (Array.isArray(item.links)) {
                                links = item.links
                                    .filter((ln: any) => ln && typeof ln === "object")
                                    .map((ln: any) => ({
                                        label: typeof ln.label === "string" ? ln.label : "",
                                        url: typeof ln.url === "string" ? ln.url : "",
                                    }))
                                    .filter((ln: OutletLink) => ln.url.trim() !== "");
                            } else if (typeof item.url === "string" && item.url.trim() !== "") {
                                // Backwards-compat: older data used a single `url` field
                                links = [
                                    {
                                        label: "Nettside",
                                        url: item.url,
                                    },
                                ];
                            }

                            return {
                                id: idBase,
                                name: typeof item.name === "string" ? item.name : "",
                                place: typeof item.place === "string" ? item.place : "",
                                kind: typeof item.kind === "string" ? item.kind : "",
                                address: typeof item.address === "string" ? item.address : "",
                                links,
                                hasSafteri: Boolean(item.hasSafteri),
                                hasBryggeri: Boolean(item.hasBryggeri),
                                lat: typeof item.lat === "number" ? item.lat : null,
                                lng: typeof item.lng === "number" ? item.lng : null,
                            } as Outlet;
                        })
                        .filter((o: Outlet | null): o is Outlet => o !== null);
                    setOutlets(loadedOutlets);
                }

                // store initial values for change detection
                setInitialOpeningSeason(loadedSeason);
                setInitialOpeningHours(loadedHours);
                setInitialOpeningNote(loadedNote);
                setInitialContactAddress(loadedAddress);
                setInitialContactPhone(loadedPhone);
                setInitialContactEmail(loadedEmail);
                setInitialLandingHeroKicker(loadedHeroKicker);
                setInitialLandingHeroTitle(loadedHeroTitle);
                setInitialLandingHeroSubtitle(loadedHeroSubtitle);
                setInitialLandingSafteriDescription(loadedSafteriDescription);
                setInitialLandingBryggeriDescription(loadedBryggeriDescription);
                setInitialLandingHeroImages(loadedHeroImages);
                setInitialLandingHeroWords(loadedHeroWords);
                setInitialLandingVisitIntro(loadedVisitIntro);
                setInitialLandingAboutText(loadedAboutText);
                setInitialSafteriHeroKicker(loadedSafteriHeroKicker);
                setInitialSafteriHeroTitle(loadedSafteriHeroTitle);
                setInitialSafteriHeroSubtitle(loadedSafteriHeroSubtitle);
                setInitialSafteriHeroWords(loadedSafteriHeroWords);
                setInitialBryggeriHeroKicker(loadedBryggeriHeroKicker);
                setInitialBryggeriHeroTitle(loadedBryggeriHeroTitle);
                setInitialBryggeriHeroSubtitle(loadedBryggeriHeroSubtitle);
                setInitialBryggeriHeroWords(loadedBryggeriHeroWords);
                setInitialSafteriKortTitle(loadedSafteriKortTitle);
                setInitialSafteriKortBullets(loadedSafteriKortBullets);
                setInitialSafteriVisitIntro(loadedSafteriVisitIntro);
                setInitialSafteriVisitDetails(loadedSafteriVisitDetails);
                setInitialSafteriAboutText(loadedSafteriAboutText);
                setInitialSafteriSaftDescription(loadedSafteriSaftDescription);
                setInitialSafteriSylteDescription(loadedSafteriSylteDescription);
                setInitialSafteriFriskDescription(loadedSafteriFriskDescription);
                setInitialSafteriReinDescription(loadedSafteriReinDescription);
                setInitialBryggeriKortTitle(loadedBryggeriKortTitle);
                setInitialBryggeriKortBullets(loadedBryggeriKortBullets);
                setInitialBryggeriOlDescription(loadedBryggeriOlDescription);
                setInitialBryggeriSiderDescription(loadedBryggeriSiderDescription);
                setInitialBryggeriVisitText(loadedBryggeriVisitText);
                setInitialBryggeriStoreText(loadedBryggeriStoreText);
                setInitialBryggeriAboutText(loadedBryggeriAboutText);
                setInitialOutlets(loadedOutlets);
            } catch (err) {
                console.error("Kunne ikkje hente opningstider:", err);
            } finally {
                setContentLoaded(true);
            }
        };

        loadContent();
    }, [user]);

    const hasChanges =
        contentLoaded &&
        (
            openingSeason !== initialOpeningSeason ||
            JSON.stringify(openingHours) !== JSON.stringify(initialOpeningHours) ||
            openingNote !== initialOpeningNote ||
            contactAddress !== initialContactAddress ||
            contactPhone !== initialContactPhone ||
            contactEmail !== initialContactEmail ||

            // Forside – hero + kort
            landingHeroKicker !== initialLandingHeroKicker ||
            landingHeroTitle !== initialLandingHeroTitle ||
            landingHeroSubtitle !== initialLandingHeroSubtitle ||
            landingSafteriDescription !== initialLandingSafteriDescription ||
            landingBryggeriDescription !== initialLandingBryggeriDescription ||
            JSON.stringify(landingHeroImages) !== JSON.stringify(initialLandingHeroImages) ||
            JSON.stringify(landingHeroWords) !== JSON.stringify(initialLandingHeroWords) ||
            landingVisitIntro !== initialLandingVisitIntro ||
            landingAboutText !== initialLandingAboutText ||

            // Safteri – hero
            safteriHeroKicker !== initialSafteriHeroKicker ||
            safteriHeroTitle !== initialSafteriHeroTitle ||
            safteriHeroSubtitle !== initialSafteriHeroSubtitle ||
            JSON.stringify(safteriHeroWords) !== JSON.stringify(initialSafteriHeroWords) ||

            // Bryggeri – hero
            bryggeriHeroKicker !== initialBryggeriHeroKicker ||
            bryggeriHeroTitle !== initialBryggeriHeroTitle ||
            bryggeriHeroSubtitle !== initialBryggeriHeroSubtitle ||
            JSON.stringify(bryggeriHeroWords) !== JSON.stringify(initialBryggeriHeroWords) ||

            // Safteri – kort fortalt / utval
            safteriKortTitle !== initialSafteriKortTitle ||
            JSON.stringify(safteriKortBullets) !== JSON.stringify(initialSafteriKortBullets) ||
            safteriVisitIntro !== initialSafteriVisitIntro ||
            safteriVisitDetails !== initialSafteriVisitDetails ||
            safteriAboutText !== initialSafteriAboutText ||
            safteriSaftDescription !== initialSafteriSaftDescription ||
            safteriSylteDescription !== initialSafteriSylteDescription ||
            safteriFriskDescription !== initialSafteriFriskDescription ||
            safteriReinDescription !== initialSafteriReinDescription ||

            // Bryggeri – kort fortalt + utvalskort
            bryggeriKortTitle !== initialBryggeriKortTitle ||
            JSON.stringify(bryggeriKortBullets) !== JSON.stringify(initialBryggeriKortBullets) ||
            bryggeriOlDescription !== initialBryggeriOlDescription ||
            bryggeriSiderDescription !== initialBryggeriSiderDescription ||
            bryggeriVisitText !== initialBryggeriVisitText ||
            bryggeriStoreText !== initialBryggeriStoreText ||
            bryggeriAboutText !== initialBryggeriAboutText ||
            JSON.stringify(outlets) !== JSON.stringify(initialOutlets)
        );

    useEffect(() => {
        if (!lastSavedSection) return;
        const timeout = setTimeout(() => setLastSavedSection(null), 2000);
        return () => clearTimeout(timeout);
    }, [lastSavedSection]);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
            setPassword("");
        } catch (err: any) {
            console.error(err);
            let message = "Kunne ikkje logge inn. Sjekk e‑post og passord.";
            if (err?.code === "auth/user-not-found") message = "Brukar finst ikkje.";
            if (err?.code === "auth/wrong-password") message = "Feil passord.";
            if (err?.code === "auth/invalid-email") message = "Ugyldig e‑postadresse.";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveContent = async (
        section: "opening" | "contact" | "landingHero" | "safteriHero" | "bryggeriHero" | "outlets",
        options?: { outletsOverride?: Outlet[] }
    ) => {
        setSaving(true);
        try {
            const outletsToSave = options?.outletsOverride ?? outlets;
            const ref = doc(db, "content", "global");
            await setDoc(
                ref,
                {
                    openingSeason,
                    openingHours,
                    openingNote,
                    contactAddress,
                    contactPhone,
                    contactEmail,
                    landingHeroKicker,
                    landingHeroTitle,
                    landingHeroSubtitle,
                    landingSafteriDescription,
                    landingBryggeriDescription,
                    landingHeroImages,
                    landingHeroWords,
                    landingVisitIntro,
                    landingAboutText,
                    safteriHeroKicker,
                    safteriHeroTitle,
                    safteriHeroSubtitle,
                    safteriHeroWords,
                    bryggeriHeroKicker,
                    bryggeriHeroTitle,
                    bryggeriHeroSubtitle,
                    bryggeriHeroWords,
                    bryggeriKortTitle,
                    bryggeriKortBullets,
                    bryggeriOlDescription,
                    bryggeriSiderDescription,
                    bryggeriVisitText,
                    bryggeriStoreText,
                    bryggeriAboutText,
                    safteriKortTitle,
                    safteriKortBullets,
                    safteriVisitIntro,
                    safteriVisitDetails,
                    safteriAboutText,
                    safteriSaftDescription,
                    safteriSylteDescription,
                    safteriFriskDescription,
                    safteriReinDescription,
                    outlets: outletsToSave,
                    updatedAt: new Date(),
                },
                { merge: true }
            );

            setInitialOpeningSeason(openingSeason);
            setInitialOpeningHours(openingHours);
            setInitialOpeningNote(openingNote);
            setInitialContactAddress(contactAddress);
            setInitialContactPhone(contactPhone);
            setInitialContactEmail(contactEmail);
            setInitialLandingHeroKicker(landingHeroKicker);
            setInitialLandingHeroTitle(landingHeroTitle);
            setInitialLandingHeroSubtitle(landingHeroSubtitle);
            setInitialLandingSafteriDescription(landingSafteriDescription);
            setInitialLandingBryggeriDescription(landingBryggeriDescription);
            setInitialLandingHeroImages(landingHeroImages);
            setInitialLandingHeroWords(landingHeroWords);
            setLastSavedSection(section);
            setInitialLandingVisitIntro(landingVisitIntro);
            setInitialLandingAboutText(landingAboutText);
            setInitialSafteriHeroKicker(safteriHeroKicker);
            setInitialSafteriHeroTitle(safteriHeroTitle);
            setInitialSafteriHeroSubtitle(safteriHeroSubtitle);
            setInitialSafteriHeroWords(safteriHeroWords);
            setInitialBryggeriHeroKicker(bryggeriHeroKicker);
            setInitialBryggeriHeroTitle(bryggeriHeroTitle);
            setInitialBryggeriHeroSubtitle(bryggeriHeroSubtitle);
            setInitialBryggeriHeroWords(bryggeriHeroWords);
            setInitialBryggeriKortTitle(bryggeriKortTitle);
            setInitialBryggeriKortBullets(bryggeriKortBullets);
            setInitialBryggeriOlDescription(bryggeriOlDescription);
            setInitialBryggeriSiderDescription(bryggeriSiderDescription);
            setInitialBryggeriVisitText(bryggeriVisitText);
            setInitialBryggeriStoreText(bryggeriStoreText);
            setInitialBryggeriAboutText(bryggeriAboutText);
            setInitialSafteriKortTitle(safteriKortTitle);
            setInitialSafteriKortBullets(safteriKortBullets);
            setInitialSafteriVisitIntro(safteriVisitIntro);
            setInitialSafteriVisitDetails(safteriVisitDetails);
            setInitialSafteriAboutText(safteriAboutText);
            setInitialSafteriSaftDescription(safteriSaftDescription);
            setInitialSafteriSylteDescription(safteriSylteDescription);
            setInitialSafteriFriskDescription(safteriFriskDescription);
            setInitialSafteriReinDescription(safteriReinDescription);
            setInitialOutlets(outletsToSave);
        } catch (err) {
            console.error("Kunne ikkje lagre innhald:", err);
        } finally {
            setSaving(false);
        }
    };

    if (checkingAuth) {
        return (
            <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
                <div className="mx-auto flex max-w-md items-center justify-center px-4 py-20">
                    <p className="text-sm text-neutral-600">Laster admin…</p>
                </div>
            </main>
        );
    }

    if (user) {
        const normalizedSearch = outletSearchTerm.trim().toLowerCase();
        const filteredOutlets = normalizedSearch
            ? outlets.filter((o) => {
                const haystack = `${o.name} ${o.place} ${o.kind}`.toLowerCase();
                return haystack.includes(normalizedSearch);
            })
            : outlets;

        return (
            <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
                <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
                    <header className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">Admin</p>
                            <h1
                                className="mt-2 text-3xl tracking-tight md:text-4xl"
                                style={{ fontFamily: "var(--font-serif)" }}
                            >
                                Valldal – administrasjon
                            </h1>
                            <p className="mt-2 text-xs text-neutral-600">
                                Innlogga som <span className="font-medium text-neutral-800">{user.email}</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Link
                                href="/admin/products"
                                className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-4 py-1.5 text-xs text-neutral-700 hover:bg-black/5"
                            >
                                Produkter
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-4 py-1.5 text-xs text-neutral-700 hover:bg-black/5"
                            >
                                Logg ut
                            </button>
                        </div>
                    </header>

                    <section className="mt-8 grid gap-6 md:grid-cols-2 items-start">
                        <div className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-5">
                            <details>
                                <summary className="flex cursor-pointer items-center justify-between list-none">
                                    <h2 className="text-sm font-medium text-neutral-900">Åpningstider</h2>
                                    <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                </summary>

                                {!contentLoaded ? (
                                    <p className="mt-2 text-xs text-neutral-600">Laster lagra opningstider …</p>
                                ) : (
                                    <div className="mt-3 space-y-4 text-xs text-neutral-700">
                                        <div className="space-y-1">
                                            <label className="font-medium" htmlFor="openingSeason">
                                                Sesong / periode
                                            </label>
                                            <input
                                                id="openingSeason"
                                                type="text"
                                                value={openingSeason}
                                                onChange={(e) => setOpeningSeason(e.target.value)}
                                                className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                placeholder="Til dømes: Vinter, Sommar 2025 osv."
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[11px] text-neutral-500">
                                                Fyll inn klokkeslett for dagane de har ope. Tomme felt blir ikkje viste på nettsida.
                                            </p>

                                            <div className="space-y-1">
                                                {dayOrder.map((day) => (
                                                    <div key={day} className="flex items-center gap-3">
                                                        <div className="w-24 text-[11px] font-medium text-neutral-800">
                                                            {dayLabels[day]}
                                                        </div>
                                                        <input
                                                            type="time"
                                                            value={openingHours[day].from}
                                                            onChange={(e) =>
                                                                setOpeningHours((prev) => ({
                                                                    ...prev,
                                                                    [day]: { ...prev[day], from: e.target.value },
                                                                }))
                                                            }
                                                            className="w-24 rounded-[8px] border border-[color:var(--line)] bg-white px-2 py-1 text-[11px] outline-none focus:border-neutral-800"
                                                        />
                                                        <span className="text-[11px] text-neutral-400">–</span>
                                                        <input
                                                            type="time"
                                                            value={openingHours[day].to}
                                                            onChange={(e) =>
                                                                setOpeningHours((prev) => ({
                                                                    ...prev,
                                                                    [day]: { ...prev[day], to: e.target.value },
                                                                }))
                                                            }
                                                            className="w-24 rounded-[8px] border border-[color:var(--line)] bg-white px-2 py-1 text-[11px] outline-none focus:border-neutral-800"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="font-medium" htmlFor="openingNote">
                                                Notat (valfritt)
                                            </label>
                                            <textarea
                                                id="openingNote"
                                                rows={3}
                                                value={openingNote}
                                                onChange={(e) => setOpeningNote(e.target.value)}
                                                className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                placeholder="Til dømes: Når vi er i produksjon held vi ofte lyset på – ta gjerne turen innom."
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleSaveContent("opening")}
                                            disabled={saving || !hasChanges}
                                            className={`mt-2 inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-xs text-[color:var(--paper)] disabled:opacity-60 ${!(saving || !hasChanges) ? "hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-transform transition-shadow" : ""}`}
                                        >
                                            {saving
                                                ? "Lagrar …"
                                                : hasChanges
                                                    ? "Lagre åpningstider"
                                                    : "Ingenting å lagre"}
                                        </button>
                                        {lastSavedSection === "opening" && !saving && (
                                            <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                                                Åpningstider lagra.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </details>
                        </div>

                        <div className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-5">
                            <details>
                                <summary className="flex cursor-pointer items-center justify-between list-none">
                                    <h2 className="text-sm font-medium text-neutral-900">Kontakt</h2>
                                    <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                </summary>
                                <div className="mt-3 space-y-3 text-xs text-neutral-700">
                                    <div className="space-y-1">
                                        <label className="font-medium" htmlFor="contactAddress">
                                            Adresse
                                        </label>
                                        <input
                                            id="contactAddress"
                                            type="text"
                                            value={contactAddress}
                                            onChange={(e) => setContactAddress(e.target.value)}
                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                            placeholder="Til dømes: Syltegata 15"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="font-medium" htmlFor="contactPhone">
                                            Telefon
                                        </label>
                                        <input
                                            id="contactPhone"
                                            type="text"
                                            value={contactPhone}
                                            onChange={(e) => setContactPhone(e.target.value)}
                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                            placeholder="Til dømes: 994 69 704"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="font-medium" htmlFor="contactEmail">
                                            E-post
                                        </label>
                                        <input
                                            id="contactEmail"
                                            type="email"
                                            value={contactEmail}
                                            onChange={(e) => setContactEmail(e.target.value)}
                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                            placeholder="Til dømes: post@valldalsafteri.no"
                                        />
                                    </div>

                                    <p className="mt-1 text-[11px] text-neutral-500">
                                        Kontaktinformasjon blir brukt både i besøk-seksjonane og i botnteksten på sida.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => handleSaveContent("contact")}
                                        disabled={saving || !hasChanges}
                                        className={`mt-3 inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-xs text-[color:var(--paper)] disabled:opacity-60 ${!(saving || !hasChanges) ? "hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-transform transition-shadow" : ""}`}
                                    >
                                        {saving
                                            ? "Lagrar …"
                                            : hasChanges
                                                ? "Lagre kontaktinfo"
                                                : "Ingenting å lagre"}
                                    </button>
                                    {lastSavedSection === "contact" && !saving && (
                                        <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                                            Kontaktinformasjon lagra.
                                        </div>
                                    )}
                                </div>
                            </details>
                        </div>
                    </section>

                    <section className="mt-6">
                        <div className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-5">
                            <details>
                                <summary className="flex cursor-pointer items-center justify-between list-none">
                                    <h2 className="text-sm font-medium text-neutral-900">Utsal</h2>
                                    <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                </summary>

                                <div className="mt-3 space-y-3 text-xs text-neutral-700">
                                    <p className="text-[11px] text-neutral-500">
                                        Her kan du legge inn stader der ein finn produkta våre. Desse blir viste på «Andre utsalsstadar»-sida.
                                    </p>

                                    <div className="space-y-3">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[11px] font-medium text-neutral-700" htmlFor="outletSearch">
                                                    Søk i utsal
                                                </label>
                                                <input
                                                    id="outletSearch"
                                                    type="text"
                                                    value={outletSearchTerm}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        setOutletSearchTerm(value);
                                                        if (value.trim() === "") {
                                                            setNewOutletId(null);
                                                        }
                                                    }}
                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Søk på namn, stad eller type …"
                                                />
                                            </div>
                                            <div className="pt-1 md:pt-0">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newId = `outlet-${Date.now()}-${Math.random()
                                                            .toString(36)
                                                            .slice(2, 8)}`;

                                                        setNewOutletId(newId);
                                                        setOutlets((prev) => [
                                                            {
                                                                id: newId,
                                                                name: "",
                                                                place: "",
                                                                kind: "",
                                                                address: "",
                                                                links: [],
                                                                hasSafteri: false,
                                                                hasBryggeri: false,
                                                            },
                                                            ...prev,
                                                        ]);
                                                    }}
                                                    className="mt-1 inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-4 py-1.5 text-[11px] text-neutral-800 hover:bg-black/5"
                                                >
                                                    + Legg til utsal
                                                </button>
                                            </div>
                                        </div>

                                        {filteredOutlets.map((outlet, index) => (
                                            <details
                                                key={outlet.id}
                                                open={outlet.id === newOutletId}
                                                className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-3"
                                            >
                                                <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-medium text-neutral-900">
                                                            {(outlet.name || "").trim() || `Utsal ${index + 1}`}
                                                        </span>
                                                        {outlet.place && (
                                                            <span className="text-[11px] text-neutral-500">
                                                                {outlet.place}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();

                                                                const confirmed = window.confirm(
                                                                    "Er du sikker på at du vil slette dette utsalet?"
                                                                );
                                                                if (!confirmed) return;

                                                                const updatedOutlets = outlets.filter((o) => o.id !== outlet.id);
                                                                setOutlets(updatedOutlets);

                                                                await handleSaveContent("outlets", { outletsOverride: updatedOutlets });
                                                            }}
                                                            className="text-[11px] text-red-600 hover:underline"
                                                        >
                                                            Slett
                                                        </button>
                                                        <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                                    </div>
                                                </summary>

                                                <div className="mt-3 space-y-3 text-xs text-neutral-700">
                                                    <div className="grid gap-2 md:grid-cols-2">
                                                        <div className="space-y-1">
                                                            <label
                                                                className="font-medium text-[11px]"
                                                                htmlFor={`outlet-name-${outlet.id}`}
                                                            >
                                                                Namn
                                                            </label>
                                                            <input
                                                                id={`outlet-name-${outlet.id}`}
                                                                type="text"
                                                                value={outlet.name}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    setOutlets((prev) =>
                                                                        prev.map((o) =>
                                                                            o.id === outlet.id ? { ...o, name: value } : o
                                                                        )
                                                                    );
                                                                }}
                                                                className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                placeholder="Til dømes: Coop Marked Valldal"
                                                            />
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label
                                                                className="font-medium text-[11px]"
                                                                htmlFor={`outlet-place-${outlet.id}`}
                                                            >
                                                                Stad
                                                            </label>
                                                            <input
                                                                id={`outlet-place-${outlet.id}`}
                                                                type="text"
                                                                value={outlet.place}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    setOutlets((prev) =>
                                                                        prev.map((o) =>
                                                                            o.id === outlet.id ? { ...o, place: value } : o
                                                                        )
                                                                    );
                                                                }}
                                                                className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                placeholder="Til dømes: Valldal"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-2 md:grid-cols-2 mt-2">
                                                        <div className="space-y-1">
                                                            <label
                                                                className="font-medium text-[11px]"
                                                                htmlFor={`outlet-kind-${outlet.id}`}
                                                            >
                                                                Type stad
                                                            </label>
                                                            <input
                                                                id={`outlet-kind-${outlet.id}`}
                                                                type="text"
                                                                value={outlet.kind}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    setOutlets((prev) =>
                                                                        prev.map((o) =>
                                                                            o.id === outlet.id ? { ...o, kind: value } : o
                                                                        )
                                                                    );
                                                                }}
                                                                className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                placeholder="Til dømes: Butikk, kafé, hotell …"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 space-y-2">
                                                        <label className="font-medium text-[11px]">
                                                            Lenkjer (valfritt)
                                                        </label>
                                                        <p className="text-[11px] text-neutral-500">
                                                            Skriv til dømes «Nettside», «Facebook» eller «Instagram», og legg inn adressa. Teksten du skriv blir vist som lenkje på nettsida.
                                                        </p>

                                                        {(outlet.links ?? []).map((link, linkIndex) => (
                                                            <div
                                                                key={`${outlet.id}-link-${linkIndex}`}
                                                                className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
                                                            >
                                                                <div className="space-y-1">
                                                                    <label
                                                                        className="text-[11px] font-medium"
                                                                        htmlFor={`outlet-link-label-${outlet.id}-${linkIndex}`}
                                                                    >
                                                                        Tekst
                                                                    </label>
                                                                    <input
                                                                        id={`outlet-link-label-${outlet.id}-${linkIndex}`}
                                                                        type="text"
                                                                        value={link.label}
                                                                        onChange={(e) => {
                                                                            const value = e.target.value;
                                                                            setOutlets((prev) =>
                                                                                prev.map((o) => {
                                                                                    if (o.id !== outlet.id) return o;
                                                                                    const nextLinks = [...o.links];
                                                                                    nextLinks[linkIndex] = {
                                                                                        ...nextLinks[linkIndex],
                                                                                        label: value,
                                                                                    };
                                                                                    return { ...o, links: nextLinks };
                                                                                })
                                                                            );
                                                                        }}
                                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                        placeholder="Til dømes: Nettside, Facebook …"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label
                                                                        className="text-[11px] font-medium"
                                                                        htmlFor={`outlet-link-url-${outlet.id}-${linkIndex}`}
                                                                    >
                                                                        URL
                                                                    </label>
                                                                    <input
                                                                        id={`outlet-link-url-${outlet.id}-${linkIndex}`}
                                                                        type="text"
                                                                        value={link.url}
                                                                        onChange={(e) => {
                                                                            const value = e.target.value;
                                                                            setOutlets((prev) =>
                                                                                prev.map((o) => {
                                                                                    if (o.id !== outlet.id) return o;
                                                                                    const nextLinks = [...o.links];
                                                                                    nextLinks[linkIndex] = {
                                                                                        ...nextLinks[linkIndex],
                                                                                        url: value,
                                                                                    };
                                                                                    return { ...o, links: nextLinks };
                                                                                })
                                                                            );
                                                                        }}
                                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                        placeholder="Til dømes: https://…"
                                                                    />
                                                                </div>
                                                                <div className="pb-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setOutlets((prev) =>
                                                                                prev.map((o) => {
                                                                                    if (o.id !== outlet.id) return o;
                                                                                    return {
                                                                                        ...o,
                                                                                        links: o.links.filter((_, i) => i !== linkIndex),
                                                                                    };
                                                                                })
                                                                            );
                                                                        }}
                                                                        className="text-[11px] text-red-600 hover:underline"
                                                                    >
                                                                        Fjern
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setOutlets((prev) =>
                                                                    prev.map((o) =>
                                                                        o.id === outlet.id
                                                                            ? { ...o, links: [...o.links, { label: "", url: "" }] }
                                                                            : o
                                                                    )
                                                                );
                                                            }}
                                                            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-3 py-1.5 text-[11px] text-neutral-800 hover:bg-black/5"
                                                        >
                                                            + Legg til lenkje
                                                        </button>
                                                    </div>

                                                    <div className="mt-2 space-y-1">
                                                        <label
                                                            className="font-medium text-[11px]"
                                                            htmlFor={`outlet-address-${outlet.id}`}
                                                        >
                                                            Adresse (for kart / «nær meg»)
                                                        </label>
                                                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                                            <input
                                                                id={`outlet-address-${outlet.id}`}
                                                                type="text"
                                                                value={outlet.address}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    setOutlets((prev) =>
                                                                        prev.map((o) =>
                                                                            o.id === outlet.id
                                                                                ? { ...o, address: value }
                                                                                : o
                                                                        )
                                                                    );
                                                                }}
                                                                className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                placeholder="Til dømes: Syltegata 15, 6210 Valldal"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={async (e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();

                                                                    const address = (outlet.address || "").trim();
                                                                    if (!address) {
                                                                        setGeoErrorById((prev) => ({
                                                                            ...prev,
                                                                            [outlet.id]: "Skriv inn ei adresse før du hentar koordinatar.",
                                                                        }));
                                                                        return;
                                                                    }

                                                                    // 🔹 reset status
                                                                    setGeoErrorById((prev) => ({ ...prev, [outlet.id]: null }));
                                                                    setGeoSuccessById((prev) => ({ ...prev, [outlet.id]: false }));
                                                                    setGeoLoadingId(outlet.id);

                                                                    try {
                                                                        const res = await fetch("/api/geocode", {
                                                                            method: "POST",
                                                                            headers: {
                                                                                "Content-Type": "application/json",
                                                                            },
                                                                            body: JSON.stringify({ address }),
                                                                        });

                                                                        const data = await res.json().catch(() => null);

                                                                        if (
                                                                            !res.ok ||
                                                                            !data ||
                                                                            typeof data.lat !== "number" ||
                                                                            typeof data.lng !== "number"
                                                                        ) {
                                                                            const message =
                                                                                (data && typeof data.error === "string" && data.error) ||
                                                                                "Kunne ikkje hente koordinatar for denne adressa.";

                                                                            setGeoErrorById((prev) => ({
                                                                                ...prev,
                                                                                [outlet.id]: message,
                                                                            }));
                                                                            return;
                                                                        }

                                                                        const { lat, lng } = data as { lat: number; lng: number };

                                                                        setOutlets((prev) =>
                                                                            prev.map((o) =>
                                                                                o.id === outlet.id ? { ...o, lat, lng } : o
                                                                            )
                                                                        );

                                                                        // ✅ suksess-toast
                                                                        setGeoSuccessById((prev) => ({ ...prev, [outlet.id]: true }));
                                                                        setTimeout(() => {
                                                                            setGeoSuccessById((prev) => ({ ...prev, [outlet.id]: false }));
                                                                        }, 2000);
                                                                    } catch (err) {
                                                                        console.error("Feil ved henting av koordinatar:", err);
                                                                        setGeoErrorById((prev) => ({
                                                                            ...prev,
                                                                            [outlet.id]: "Noko gjekk gale ved henting av koordinatar.",
                                                                        }));
                                                                    } finally {
                                                                        setGeoLoadingId(null);
                                                                    }
                                                                }}
                                                                className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-3 py-1.5 text-[11px] text-neutral-800 hover:bg-black/5 disabled:opacity-60"
                                                                disabled={geoLoadingId === outlet.id}
                                                            >
                                                                {geoLoadingId === outlet.id ? "Hentar …" : "Hent koordinatar"}
                                                            </button>
                                                            {geoSuccessById[outlet.id] && (
                                                                <div className="mt-1 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                                                                    Koordinatar henta.
                                                                </div>
                                                            )}
                                                        </div>
                                                        {geoErrorById[outlet.id] && (
                                                            <p className="text-[11px] text-red-600">
                                                                {geoErrorById[outlet.id]}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap gap-3">
                                                        <label className="inline-flex items-center gap-1 text-[11px] text-neutral-800">
                                                            <input
                                                                type="checkbox"
                                                                checked={outlet.hasSafteri}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setOutlets((prev) =>
                                                                        prev.map((o) =>
                                                                            o.id === outlet.id
                                                                                ? { ...o, hasSafteri: checked }
                                                                                : o
                                                                        )
                                                                    );
                                                                }}
                                                                className="h-3.5 w-3.5 rounded border border-[color:var(--line)]"
                                                            />
                                                            <span>Safteri</span>
                                                        </label>
                                                        <label className="inline-flex items-center gap-1 text-[11px] text-neutral-800">
                                                            <input
                                                                type="checkbox"
                                                                checked={outlet.hasBryggeri}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setOutlets((prev) =>
                                                                        prev.map((o) =>
                                                                            o.id === outlet.id
                                                                                ? { ...o, hasBryggeri: checked }
                                                                                : o
                                                                        )
                                                                    );
                                                                }}
                                                                className="h-3.5 w-3.5 rounded border border-[color:var(--line)]"
                                                            />
                                                            <span>Bryggeri</span>
                                                        </label>
                                                    </div>
                                                    <div className="mt-3 flex items-center justify-between">
                                                        <button
                                                            type="button"
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                await handleSaveContent("outlets");
                                                            }}
                                                            disabled={saving || !hasChanges}
                                                            className={`inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-[11px] text-[color:var(--paper)] disabled:opacity-60 ${!(saving || !hasChanges)
                                                                ? "hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-transform transition-shadow"
                                                                : ""
                                                                }`}
                                                        >
                                                            {saving
                                                                ? "Lagrar …"
                                                                : hasChanges
                                                                    ? "Lagre dette utsalet"
                                                                    : "Ingenting å lagre"}
                                                        </button>

                                                        {lastSavedSection === "outlets" && !saving && (
                                                            <span className="text-[11px] text-emerald-700">
                                                                Utsal lagra.
                                                            </span>
                                                        )}
                                                    </div>


                                                </div>
                                            </details>
                                        ))}
                                    </div>


                                </div>
                            </details>
                        </div>
                    </section>
                    <section className="mt-6">
                        <div className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-5">
                            <details>
                                <summary className="flex cursor-pointer items-center justify-between list-none">
                                    <h2 className="text-sm font-medium text-neutral-900">Forside</h2>
                                    <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                </summary>

                                <div className="mt-3 space-y-4 text-xs text-neutral-700">
                                    {/* HERO: kicker, tittel, undertekst, tre ord */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Hoved</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-3">
                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="landingHeroKicker">
                                                        Kicker (liten tekst over tittel)
                                                    </label>
                                                    <input
                                                        id="landingHeroKicker"
                                                        type="text"
                                                        value={landingHeroKicker}
                                                        onChange={(e) => setLandingHeroKicker(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Til dømes: Handverk frå Valldal"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="landingHeroTitle">
                                                        Tittel
                                                    </label>
                                                    <textarea
                                                        id="landingHeroTitle"
                                                        rows={3}
                                                        value={landingHeroTitle}
                                                        onChange={(e) => setLandingHeroTitle(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Skriv tittelen — bruk Enter for ny linje."
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="landingHeroSubtitle">
                                                        Undertekst
                                                    </label>
                                                    <textarea
                                                        id="landingHeroSubtitle"
                                                        rows={3}
                                                        value={landingHeroSubtitle}
                                                        onChange={(e) => setLandingHeroSubtitle(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Kort tekst under tittelen på forsida."
                                                    />
                                                </div>

                                                <div className="mt-2 space-y-1">
                                                    <label className="font-medium">
                                                        Linje under tittel (tre ord)
                                                    </label>
                                                    <p className="text-[11px] text-neutral-500">
                                                        Kvar boks er eitt ord eller ei kort frase. Desse blir viste med små prikkar mellom på forsida.
                                                    </p>
                                                    <div className="mt-1 flex flex-col gap-2 md:flex-row">
                                                        {landingHeroWords.map((value, index) => (
                                                            <div key={index} className="flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={value}
                                                                    onChange={(e) => {
                                                                        const next = [...landingHeroWords];
                                                                        next[index] = e.target.value;
                                                                        setLandingHeroWords(next);
                                                                    }}
                                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                    placeholder={
                                                                        index === 0
                                                                            ? "Til dømes: Natur"
                                                                            : index === 1
                                                                                ? "Reine råvarer"
                                                                                : "Handverk"
                                                                    }
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>

                                    {/* HERO-BILETE: image upload and thumbnails */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Bilete</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-3">
                                                <div className="space-y-1">
                                                    <label className="font-medium">
                                                        Hero-bilete (opplasting)
                                                    </label>
                                                    <p className="text-[11px] text-neutral-500">
                                                        Last opp eitt eller fleire bilete. Nettsida vel automatisk eitt per dag.
                                                        Bileta kan gjerne ha innebygd vannmerke.
                                                    </p>
                                                    <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                        <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-[11px] font-medium text-neutral-800 hover:bg-black/5">
                                                            <span>{heroUploading ? "Laster opp …" : "Last opp bilete"}</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                onChange={async (e) => {
                                                                    const files = e.target.files;
                                                                    if (!files || files.length === 0) return;
                                                                    setHeroUploadError(null);
                                                                    setHeroUploading(true);
                                                                    try {
                                                                        const uploadedUrls: string[] = [];

                                                                        for (const file of Array.from(files)) {
                                                                            try {
                                                                                const safeName = `${Date.now()}-${file.name}`;
                                                                                const ref = storageRef(storage, `hero/${safeName}`);
                                                                                await uploadBytes(ref, file);
                                                                                const url = await getDownloadURL(ref);
                                                                                uploadedUrls.push(url);
                                                                            } catch (fileErr) {
                                                                                console.error("Feil ved opplasting av enkeltbilete:", fileErr);
                                                                            }
                                                                        }

                                                                        if (uploadedUrls.length === 0) {
                                                                            setHeroUploadError(
                                                                                "Kunne ikkje laste opp bileta. Sjekk at du er logga inn og at lagringsreglane i Firebase tillèt opplasting."
                                                                            );
                                                                        } else {
                                                                            setLandingHeroImages((prev) => [...prev, ...uploadedUrls]);
                                                                        }
                                                                    } catch (err) {
                                                                        console.error("Feil ved opplasting av hero-bilete:", err);
                                                                        setHeroUploadError("Noko gjekk gale under opplastinga.");
                                                                    } finally {
                                                                        setHeroUploading(false);
                                                                        e.target.value = "";
                                                                    }
                                                                }}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    </div>
                                                    {heroUploadError && (
                                                        <p className="mt-1 text-[11px] text-red-600">{heroUploadError}</p>
                                                    )}
                                                    <div className="mt-3">
                                                        {landingHeroImages.length === 0 ? (
                                                            <p className="text-[11px] text-neutral-500">
                                                                Ingen bilete lasta opp enno.
                                                            </p>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-3">
                                                                {landingHeroImages.map((url, index) => (
                                                                    <div
                                                                        key={url + index}
                                                                        className="relative h-20 w-20 overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-neutral-100"
                                                                    >
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img
                                                                            src={url}
                                                                            alt={`Hero-bilete ${index + 1}`}
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={async () => {
                                                                                const confirmed = window.confirm(
                                                                                    "Er du sikker på at du vil slette dette biletet?"
                                                                                );
                                                                                if (!confirmed) return;
                                                                                try {
                                                                                    const ref = storageRef(storage, url);
                                                                                    await deleteObject(ref).catch(() => {
                                                                                        // ignore storage delete failure
                                                                                    });
                                                                                } catch (err) {
                                                                                    console.error("Feil ved sletting av hero-bilete:", err);
                                                                                } finally {
                                                                                    setLandingHeroImages((prev) => prev.filter((u) => u !== url));
                                                                                }
                                                                            }}
                                                                            className="absolute right-0 top-0 m-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white hover:bg-black/90"
                                                                            aria-label="Slett bilete"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>

                                    {/* FORSIDE-KORT: tekst for Safteri og Bryggeri */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Knapper</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Tekstane som står under «Safteri» og «Bryggeri» på forsida.
                                                </p>
                                                <div className="mt-2 space-y-2">
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">
                                                            Safteri
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={landingSafteriDescription}
                                                            onChange={(e) => setLandingSafteriDescription(e.target.value)}
                                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="Teksten under Safteri-knappen på forsida."
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">
                                                            Bryggeri
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={landingBryggeriDescription}
                                                            onChange={(e) => setLandingBryggeriDescription(e.target.value)}
                                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="Teksten under Bryggeri-knappen på forsida."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>

                                    {/* Besøk – tekst */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Besøk</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Den korte teksten som står under «Besøk» på forsida (over åpningstidene).
                                                </p>
                                                <textarea
                                                    rows={3}
                                                    value={landingVisitIntro}
                                                    onChange={(e) => setLandingVisitIntro(e.target.value)}
                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Til dømes: Besøk Valldal Safteri og Bryggeri…"
                                                />
                                            </div>
                                        </details>
                                    </div>

                                    {/* Om Valldal – tekst */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Om Valldal</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Teksten som står i «Om Valldal»-seksjonen på forsida.
                                                </p>
                                                <textarea
                                                    rows={4}
                                                    value={landingAboutText}
                                                    onChange={(e) => setLandingAboutText(e.target.value)}
                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Til dømes ei kort historie om safteriet og bryggeriet."
                                                />
                                            </div>
                                        </details>
                                    </div>



                                    {/* Save button + toast for all Forside content */}
                                    <button
                                        type="button"
                                        onClick={() => handleSaveContent("landingHero")}
                                        disabled={saving || !hasChanges}
                                        className={`mt-3 inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-xs text-[color:var(--paper)] disabled:opacity-60 ${!(saving || !hasChanges)
                                            ? "hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-transform transition-shadow"
                                            : ""
                                            }`}
                                    >
                                        {saving
                                            ? "Lagrar …"
                                            : hasChanges
                                                ? "Lagre forside-innhald"
                                                : "Ingenting å lagre"}
                                    </button>
                                    {lastSavedSection === "landingHero" && !saving && (
                                        <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                                            Forside-innhald lagra.
                                        </div>
                                    )}
                                </div>
                            </details>
                        </div>
                    </section>
                    <section className="mt-6">
                        <div className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-5">
                            <details>
                                <summary className="flex cursor-pointer items-center justify-between list-none">
                                    <h2 className="text-sm font-medium text-neutral-900">Safteri</h2>
                                    <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                </summary>

                                <div className="mt-3 space-y-4 text-xs text-neutral-700">
                                    {/* HERO: kicker, tittel, undertekst, tre ord (Safteri) */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Hoved</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-3">
                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="safteriHeroKicker">
                                                        Kicker (liten tekst over tittel)
                                                    </label>
                                                    <input
                                                        id="safteriHeroKicker"
                                                        type="text"
                                                        value={safteriHeroKicker}
                                                        onChange={(e) => setSafteriHeroKicker(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Til dømes: Saft og sylte frå Valldal"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="safteriHeroTitle">
                                                        Tittel
                                                    </label>
                                                    <textarea
                                                        id="safteriHeroTitle"
                                                        rows={3}
                                                        value={safteriHeroTitle}
                                                        onChange={(e) => setSafteriHeroTitle(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Skriv tittelen — bruk Enter for ny linje."
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="safteriHeroSubtitle">
                                                        Undertekst
                                                    </label>
                                                    <textarea
                                                        id="safteriHeroSubtitle"
                                                        rows={3}
                                                        value={safteriHeroSubtitle}
                                                        onChange={(e) => setSafteriHeroSubtitle(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Kort tekst under tittelen på Safteri-sida."
                                                    />
                                                </div>

                                                <div className="mt-2 space-y-1">
                                                    <label className="font-medium">
                                                        Linje under tittel (tre ord)
                                                    </label>
                                                    <p className="text-[11px] text-neutral-500">
                                                        Kvar boks er eitt ord eller ei kort frase. Desse blir viste med små prikkar mellom på Safteri-sida.
                                                    </p>
                                                    <div className="mt-1 flex flex-col gap-2 md:flex-row">
                                                        {safteriHeroWords.map((value, index) => (
                                                            <div key={index} className="flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={value}
                                                                    onChange={(e) => {
                                                                        const next = [...safteriHeroWords];
                                                                        next[index] = e.target.value;
                                                                        setSafteriHeroWords(next);
                                                                    }}
                                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                    placeholder={
                                                                        index === 0
                                                                            ? "Til dømes: Bær"
                                                                            : index === 1
                                                                                ? "Frukt"
                                                                                : "Tradisjon"
                                                                    }
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>

                                    {/* Kort fortalt – Safteri */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Kort fortalt</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-3">
                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="safteriKortTitle">
                                                        Overskrift
                                                    </label>
                                                    <input
                                                        id="safteriKortTitle"
                                                        type="text"
                                                        value={safteriKortTitle}
                                                        onChange={(e) => setSafteriKortTitle(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Til dømes: Reine råvarer, handverk, tid."
                                                    />
                                                </div>

                                                <div className="mt-2 space-y-1">
                                                    <label className="font-medium">
                                                        Punktliste (tre korte punkt)
                                                    </label>
                                                    <p className="text-[11px] text-neutral-500">
                                                        Kvar boks er eitt punkt i «Kort fortalt»-lista på Safteri-sida.
                                                    </p>
                                                    <div className="mt-1 flex flex-col gap-2">
                                                        {safteriKortBullets.map((value, index) => (
                                                            <div key={index}>
                                                                <input
                                                                    type="text"
                                                                    value={value}
                                                                    onChange={(e) => {
                                                                        const next = [...safteriKortBullets];
                                                                        next[index] = e.target.value;
                                                                        setSafteriKortBullets(next);
                                                                    }}
                                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                    placeholder={
                                                                        index === 0
                                                                            ? "Til dømes: Bær frå Norddalsfjorden"
                                                                            : index === 1
                                                                                ? "Saft og sylte laga frå botnen"
                                                                                : "Små seriar – stor omtanke"
                                                                    }
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>



                                    {/* Utval-kort: tekst for Safteri-kategoriane */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Utval</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Tekstane som står inne i korta for «Saft», «Sylte og gelé», «Frisk» og «Rein» på Safteri-sida.
                                                </p>
                                                <div className="mt-2 space-y-2">
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">
                                                            Saft
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={safteriSaftDescription}
                                                            onChange={(e) => setSafteriSaftDescription(e.target.value)}
                                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="Teksten som står i Saft-kortet."
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">
                                                            Sylte og gelé
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={safteriSylteDescription}
                                                            onChange={(e) => setSafteriSylteDescription(e.target.value)}
                                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="Teksten som står i Sylte og gelé-kortet."
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">
                                                            Frisk
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={safteriFriskDescription}
                                                            onChange={(e) => setSafteriFriskDescription(e.target.value)}
                                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="Teksten som står i Frisk-kortet."
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">
                                                            Rein
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={safteriReinDescription}
                                                            onChange={(e) => setSafteriReinDescription(e.target.value)}
                                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="Teksten som står i Rein-kortet."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>

                                    {/* Besøk – Safteri */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Besøk</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Den korte teksten som står under «Besøk» på Safteri-sida (over butikk og åpningstider).
                                                </p>
                                                <textarea
                                                    rows={3}
                                                    value={safteriVisitIntro}
                                                    onChange={(e) => setSafteriVisitIntro(e.target.value)}
                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Til dømes: Besøk safteriet – her finn du saft, sylte og gåver frå Valldal."
                                                />
                                            </div>
                                        </details>
                                    </div>

                                    {/* Besøk – Safteri (lengre tekst) */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Butikk</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Lengre tekst om butikk, besøk og oppleving. Du kan bruke Enter for å lage avsnitt og mellomrom mellom linjer.
                                                </p>
                                                <textarea
                                                    rows={6}
                                                    value={safteriVisitDetails}
                                                    onChange={(e) => setSafteriVisitDetails(e.target.value)}
                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Til dømes: informasjon om butikken, når det passar å komme innom, smaksmoglegheiter osv."
                                                />
                                            </div>
                                        </details>
                                    </div>




                                    {/* Om safteriet – tekst */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Om safteriet</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Teksten som står i «Om safteriet»-seksjonen på Safteri-sida.
                                                </p>
                                                <textarea
                                                    rows={4}
                                                    value={safteriAboutText}
                                                    onChange={(e) => setSafteriAboutText(e.target.value)}
                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Til dømes ei kort historie om safteriet."
                                                />
                                            </div>
                                        </details>
                                    </div>

                                    {/* Save button + toast for all Forside content */}
                                    <button
                                        type="button"
                                        onClick={() => handleSaveContent("safteriHero")}
                                        disabled={saving || !hasChanges}
                                        className={`mt-3 inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-xs text-[color:var(--paper)] disabled:opacity-60 ${!(saving || !hasChanges)
                                            ? "hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-transform transition-shadow"
                                            : ""
                                            }`}
                                    >
                                        {saving
                                            ? "Lagrar …"
                                            : hasChanges
                                                ? "Lagre safteri-innhald"
                                                : "Ingenting å lagre"}
                                    </button>
                                    {lastSavedSection === "safteriHero" && !saving && (
                                        <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                                            Safteri-innhald lagra.
                                        </div>
                                    )}
                                </div>
                            </details>
                        </div>
                    </section>

                    <section className="mt-6">
                        <div className="rounded-[18px] border border-[color:var(--line)] bg-white/70 p-5">
                            <details>
                                <summary className="flex cursor-pointer items-center justify-between list-none">
                                    <h2 className="text-sm font-medium text-neutral-900">Bryggeri</h2>
                                    <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                </summary>

                                <div className="mt-3 space-y-4 text-xs text-neutral-700">
                                    {/* HERO: kicker, tittel, undertekst, tre ord (Bryggeri) */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Hoved</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-3">
                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="bryggeriHeroKicker">
                                                        Kicker (liten tekst over tittel)
                                                    </label>
                                                    <input
                                                        id="bryggeriHeroKicker"
                                                        type="text"
                                                        value={bryggeriHeroKicker}
                                                        onChange={(e) => setBryggeriHeroKicker(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Til dømes: Brygg frå Valldal"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="bryggeriHeroTitle">
                                                        Tittel
                                                    </label>
                                                    <textarea
                                                        id="bryggeriHeroTitle"
                                                        rows={3}
                                                        value={bryggeriHeroTitle}
                                                        onChange={(e) => setBryggeriHeroTitle(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Skriv tittelen — bruk Enter for ny linje."
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="bryggeriHeroSubtitle">
                                                        Undertekst
                                                    </label>
                                                    <textarea
                                                        id="bryggeriHeroSubtitle"
                                                        rows={3}
                                                        value={bryggeriHeroSubtitle}
                                                        onChange={(e) => setBryggeriHeroSubtitle(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Kort tekst under tittelen på Bryggeri-sida."
                                                    />
                                                </div>

                                                <div className="mt-2 space-y-1">
                                                    <label className="font-medium">
                                                        Linje under tittel (tre ord)
                                                    </label>
                                                    <p className="text-[11px] text-neutral-500">
                                                        Kvar boks er eitt ord eller ei kort frase. Desse blir viste med små prikkar mellom på Bryggeri-sida.
                                                    </p>
                                                    <div className="mt-1 flex flex-col gap-2 md:flex-row">
                                                        {bryggeriHeroWords.map((value, index) => (
                                                            <div key={index} className="flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={value}
                                                                    onChange={(e) => {
                                                                        const next = [...bryggeriHeroWords];
                                                                        next[index] = e.target.value;
                                                                        setBryggeriHeroWords(next);
                                                                    }}
                                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                    placeholder={
                                                                        index === 0
                                                                            ? "Til dømes: Malt"
                                                                            : index === 1
                                                                                ? "Gjær"
                                                                                : "Tid"
                                                                    }
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>
                                    {/* Kort fortalt – Bryggeri */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Kort fortalt</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-3">
                                                <div className="space-y-1">
                                                    <label className="font-medium" htmlFor="bryggeriKortTitle">
                                                        Overskrift
                                                    </label>
                                                    <input
                                                        id="bryggeriKortTitle"
                                                        type="text"
                                                        value={bryggeriKortTitle}
                                                        onChange={(e) => setBryggeriKortTitle(e.target.value)}
                                                        className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                        placeholder="Til dømes: Sider, øl og smaksopplevingar."
                                                    />
                                                </div>

                                                <div className="mt-2 space-y-1">
                                                    <label className="font-medium">
                                                        Punkt (tre linjer)
                                                    </label>
                                                    <p className="text-[11px] text-neutral-500">
                                                        Kvar boks er eitt punkt med tekst. Desse blir viste som korte setningar i «Kort fortalt» på Bryggeri-sida.
                                                    </p>
                                                    <div className="mt-1 flex flex-col gap-2">
                                                        {bryggeriKortBullets.map((value, index) => (
                                                            <div key={index} className="flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={value}
                                                                    onChange={(e) => {
                                                                        const next = [...bryggeriKortBullets];
                                                                        next[index] = e.target.value;
                                                                        setBryggeriKortBullets(next);
                                                                    }}
                                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                                    placeholder={
                                                                        index === 0
                                                                            ? "Til dømes: Frisk sider frå Valldal"
                                                                            : index === 1
                                                                                ? "Små batchar og lokale råvarer"
                                                                                : "For både kvardag og fest"
                                                                    }
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>
                                    {/* Bryggeri – utvalskort (Øl og Sider) */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Utval</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Tekstane som står under «Øl» og «Sider» på Bryggeri-sida.
                                                </p>

                                                <div className="space-y-2">
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">
                                                            Øl
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={bryggeriOlDescription}
                                                            onChange={(e) => setBryggeriOlDescription(e.target.value)}
                                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="Teksten under Øl-kortet."
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-neutral-700">
                                                            Sider
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            value={bryggeriSiderDescription}
                                                            onChange={(e) => setBryggeriSiderDescription(e.target.value)}
                                                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                            placeholder="Teksten under Sider-kortet."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    </div>
                                    {/* Besøk – tekst (Bryggeri) */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Besøk</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Teksten som står under «Besøk» på Bryggeri-sida (over åpningstidene).
                                                </p>
                                                <textarea
                                                    rows={4}
                                                    value={bryggeriVisitText}
                                                    onChange={(e) => setBryggeriVisitText(e.target.value)}
                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Til dømes: Kort tekst om besøk til bryggeriet."
                                                />
                                            </div>
                                        </details>
                                    </div>
                                    {/* Bryggeri – Butikk */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Butikk</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>

                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Teksten som står i «Butikk»-seksjonen på bryggerisida.
                                                    Du kan bruke Enter for linjeskift, og tom linje for nytt avsnitt.
                                                </p>

                                                <textarea
                                                    rows={4}
                                                    value={bryggeriStoreText}
                                                    onChange={(e) => setBryggeriStoreText(e.target.value)}
                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Skriv ein kort tekst om butikken på bryggeriet …"
                                                />
                                            </div>
                                        </details>
                                    </div>
                                    {/* Om bryggeriet – tekst */}
                                    <div className="rounded-[14px] border border-[color:var(--line)]/60 bg-white/60 px-3 py-2">
                                        <details>
                                            <summary className="flex cursor-pointer items-center justify-between list-none">
                                                <span className="text-xs font-medium text-neutral-900">Om bryggeriet</span>
                                                <span className="text-[11px] text-neutral-500">Vis/skjul</span>
                                            </summary>
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[11px] text-neutral-500">
                                                    Teksten som står i «Om bryggeriet»-seksjonen på Bryggeri-sida.
                                                    Du kan bruke Enter for ny linje, og dobbelt linjeskift for litt ekstra luft.
                                                </p>
                                                <textarea
                                                    rows={4}
                                                    value={bryggeriAboutText}
                                                    onChange={(e) => setBryggeriAboutText(e.target.value)}
                                                    className="w-full rounded-[10px] border border-[color:var(--line)] bg-white px-3 py-2 text-xs outline-none placeholder:text-neutral-400 focus:border-neutral-800"
                                                    placeholder="Til dømes ei kort historie om korleis bryggeriet kom til, og kva de ønskjer å få til."
                                                />
                                            </div>
                                        </details>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleSaveContent("bryggeriHero")}
                                        disabled={saving || !hasChanges}
                                        className={`mt-3 inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-xs text-[color:var(--paper)] disabled:opacity-60 ${!(saving || !hasChanges)
                                            ? "hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-transform transition-shadow"
                                            : ""
                                            }`}
                                    >
                                        {saving
                                            ? "Lagrar …"
                                            : hasChanges
                                                ? "Lagre bryggeri-innhald"
                                                : "Ingenting å lagre"}
                                    </button>
                                    {lastSavedSection === "bryggeriHero" && !saving && (
                                        <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                                            Bryggeri-innhald lagra.
                                        </div>
                                    )}
                                </div>
                            </details>
                        </div>
                    </section>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900">
            <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
                <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">Admin</p>
                <h1
                    className="mt-3 text-3xl tracking-tight md:text-4xl"
                    style={{ fontFamily: "var(--font-serif)" }}
                >
                    Logg inn
                </h1>
                <p className="mt-2 text-xs text-neutral-600">
                    Berre for familie og dei som hjelper til med nettstaden.
                </p>

                <form onSubmit={handleLogin} className="mt-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700" htmlFor="email">
                            E‑post
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-800"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-700" htmlFor="password">
                            Passord
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-[10px] border border-[color:var(--line)] bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-800"
                        />
                    </div>

                    {error && <p className="text-xs text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-sm text-[color:var(--paper)] transition hover:bg-neutral-800 disabled:opacity-60"
                    >
                        {submitting ? "Loggar inn…" : "Logg inn"}
                    </button>
                </form>
            </div>
        </main>
    );
}