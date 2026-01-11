"use client";

function getDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // radius of Earth in km
    const toRad = (v: number) => (v * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { siteContent } from "@/lib/siteContent";
import { ContactDisplay } from "../components/ContactDisplay";

type OutletKind = "safteri" | "bryggeri" | "begge";

type OutletLink = {
    label: string;
    url: string;
};

interface Outlet {
    id: string;
    name: string;
    city: string;
    type: string; // t.d. "Butikk", "Kafé", "Hotell"
    kinds: OutletKind[]; // kva dei fører
    address?: string;
    links: OutletLink[]; // t.d. Nettside, Facebook, Instagram
    lat?: number | null;
    lng?: number | null;
}

const filterLabels: { id: OutletKind | "alle"; label: string }[] = [
    { id: "alle", label: "Alle" },
    { id: "safteri", label: "Safteri" },
    { id: "bryggeri", label: "Bryggeri" },
    { id: "begge", label: "Begge" },
];

export default function UtsalPage() {
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadOutlets = async () => {
            try {
                const ref = doc(db, "content", "global");
                const snap = await getDoc(ref);

                if (snap.exists()) {
                    const data = snap.data() as any;

                    if (Array.isArray(data.outlets)) {
                        const parsed: Outlet[] = data.outlets
                            .filter((o: any) => o && typeof o === "object")
                            .map((o: any, index: number) => {
                                const hasSafteri = Boolean(o.hasSafteri);
                                const hasBryggeri = Boolean(o.hasBryggeri);

                                let kinds: OutletKind[] = [];
                                if (hasSafteri && hasBryggeri) {
                                    kinds = ["begge"];
                                } else if (hasSafteri) {
                                    kinds = ["safteri"];
                                } else if (hasBryggeri) {
                                    kinds = ["bryggeri"];
                                }

                                // Build links from structured data, with fallback to single url
                                let links: OutletLink[] = [];
                                if (Array.isArray(o.links)) {
                                    links = o.links
                                        .filter((ln: any) => ln && typeof ln === "object")
                                        .map((ln: any) => {
                                            const label =
                                                typeof ln.label === "string" && ln.label.trim()
                                                    ? ln.label.trim()
                                                    : "Lenkje";
                                            const url =
                                                typeof ln.url === "string" && ln.url.trim()
                                                    ? ln.url.trim()
                                                    : "";
                                            return { label, url } as OutletLink;
                                        })
                                        .filter((ln: OutletLink) => ln.url.length > 0);
                                }

                                // Backwards kompatibilitet – alltid ta med gammalt `url`-felt dersom det finst
                                if (typeof o.url === "string" && o.url.trim()) {
                                    links.push({
                                        label: "Nettside",
                                        url: o.url.trim(),
                                    });
                                }

                                return {
                                    id:
                                        typeof o.id === "string" && o.id.trim()
                                            ? o.id
                                            : `outlet-${index}`,
                                    name: typeof o.name === "string" ? o.name : "",
                                    city: typeof o.place === "string" ? o.place : "",
                                    type: typeof o.kind === "string" ? o.kind : "",
                                    kinds,
                                    address:
                                        typeof o.address === "string" && o.address.trim()
                                            ? o.address
                                            : undefined,
                                    lat: typeof o.lat === "number" ? o.lat : null,
                                    lng: typeof o.lng === "number" ? o.lng : null,
                                    links,
                                } as Outlet;
                            });

                        setOutlets(parsed);
                    }
                }
            } catch (err) {
                console.error("Kunne ikkje hente utsal:", err);
            } finally {
                setLoading(false);
            }
        };

        loadOutlets();
    }, []);

    const [activeFilter, setActiveFilter] = useState<OutletKind | "alle">("alle");
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [geoError, setGeoError] = useState<string | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [showNearest, setShowNearest] = useState(false);
    const searchRadiusKm = 25;
    const searchParams = useSearchParams();
    const from = searchParams.get("from");

    const backLink =
        from === "safteri"
            ? "/safteri"
            : from === "bryggeri"
                ? "/bryggeri"
                : "/";

    const backLabel =
        from === "safteri"
            ? "Tilbake til safteriet"
            : from === "bryggeri"
                ? "Tilbake til bryggeriet"
                : "Tilbake til forsida";

    const handleFindNearMe = () => {
        setGeoError(null);

        if (typeof navigator === "undefined" || !navigator.geolocation) {
            setGeoError("Nettlesaren støttar ikkje posisjon.");
            return;
        }

        setIsLocating(true);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                });
                console.log("User location:", pos.coords.latitude, pos.coords.longitude);
                setIsLocating(false);
            },
            (err) => {
                console.error("Geolokasjonsfeil:", err);
                if (err.code === err.PERMISSION_DENIED) {
                    setGeoError("Vi fekk ikkje tilgang til posisjonen din.");
                } else {
                    setGeoError("Klarte ikkje hente posisjonen din.");
                }
                setIsLocating(false);
            }
        );
    };

    const handleResetFilters = () => {
        setActiveFilter("alle");
        setUserLocation(null);
        setGeoError(null);
        setShowNearest(false);
    };

    const filteredByType = outlets.filter((outlet) => {
        if (activeFilter === "alle") return true;

        const hasSafteri =
            outlet.kinds.includes("safteri") || outlet.kinds.includes("begge");
        const hasBryggeri =
            outlet.kinds.includes("bryggeri") || outlet.kinds.includes("begge");

        if (activeFilter === "safteri") {
            return hasSafteri;
        }

        if (activeFilter === "bryggeri") {
            return hasBryggeri;
        }

        if (activeFilter === "begge") {
            return hasSafteri && hasBryggeri;
        }

        return true;
    });
    const sortedFilteredByType = [...filteredByType].sort((a, b) =>
        a.name.localeCompare(b.name, "nb", { sensitivity: "base" })
    );

    const nearestWithDistance = userLocation
        ? sortedFilteredByType
            .filter(
                (outlet) =>
                    typeof outlet.lat === "number" &&
                    typeof outlet.lng === "number"
            )
            .map((outlet) => ({
                outlet,
                distance: getDistanceKm(
                    userLocation.lat,
                    userLocation.lng,
                    outlet.lat as number,
                    outlet.lng as number
                ),
            }))
            .reduce<
                | {
                    outlet: Outlet;
                    distance: number;
                }
                | null
            >((best, current) => {
                if (!best) return current;
                return current.distance < best.distance ? current : best;
            }, null)
        : null;

    const visibleOutlets = userLocation
        ? sortedFilteredByType.filter((outlet) => {
            if (typeof outlet.lat !== "number" || typeof outlet.lng !== "number") {
                return false;
            }
            const dist = getDistanceKm(
                userLocation.lat,
                userLocation.lng,
                outlet.lat,
                outlet.lng
            );
            console.log(
                "Distance to outlet",
                outlet.name,
                "->",
                dist.toFixed(1),
                "km"
            );
            return dist <= searchRadiusKm;
        })
        : sortedFilteredByType;

    return (
        <main className="min-h-screen bg-[color:var(--paper)] text-neutral-900 flex flex-col">
            <div className="flex-1">
                {/* Header – same style as the other pages */}
                <header className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[color:var(--paper)]/85 backdrop-blur">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                        <Link href="/" className="flex items-center">
                            <Image
                                src="/logoDark.png"
                                alt="Valldal"
                                width={120}
                                height={32}
                                priority
                                className="h-6 w-auto"
                            />
                        </Link>

                        <nav className="flex items-center gap-4 text-sm text-neutral-700">
                            <Link className="hover:text-neutral-900" href="/">
                                Heim
                            </Link>

                            <Link className="hover:text-neutral-900" href="/safteri">
                                Safteri
                            </Link>

                            <Link className="hover:text-neutral-900" href="/bryggeri">
                                Bryggeri <span className="ml-1 text-xs opacity-70">18+</span>
                            </Link>
                        </nav>
                    </div>
                </header>

                {/* Intro */}
                <section className="mx-auto max-w-6xl px-4 pt-10 md:pt-16">
                    <div className="max-w-3xl">
                        <div className="mb-4">
                            <Link
                                href={backLink}
                                className="inline-flex items-center gap-1 text-sm font-medium text-neutral-800 underline-offset-4 hover:text-neutral-900 hover:underline md:text-base"
                            >
                                <span className="text-base md:text-lg">←</span>
                                <span>{backLabel}</span>
                            </Link>
                        </div>
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
                            Utsal
                        </p>
                        <h1
                            className="mt-3 text-4xl tracking-tight md:text-5xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            Her får du kjøpt produkta våre.
                        </h1>
                        <p className="mt-4 text-sm leading-7 text-neutral-600 max-w-prose">
                            Ei oversikt over utvalde butikkar, kafear, hotell og serveringsstader som
                            fører Valldal Safteri og Valldal Bryggeri. Utvalet kan variere gjennom året –
                            sjekk gjerne med staden om du er på jakt etter noko spesielt.
                        </p>
                        <p className="mt-3 max-w-prose text-[11px] leading-6 text-neutral-500">
                            <strong className="font-medium text-neutral-700">Saknar du ein stad?</strong>{" "}
                            Dersom du fører produkta våre, men ikkje finn verksemda di i lista, ta gjerne
                            kontakt med oss på telefon eller e-post – så legg vi deg til.
                        </p>
                    </div>

                    {/* Filter / actions */}
                    <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {filterLabels.map((filter) => {
                                const isActive = activeFilter === filter.id;
                                return (
                                    <button
                                        key={filter.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveFilter(filter.id);
                                            setShowNearest(false);
                                        }}
                                        className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] transition 
                    ${isActive
                                                ? "border-neutral-900 bg-neutral-900 text-[color:var(--paper)]"
                                                : "border-[color:var(--line)] bg-white/60 text-neutral-700 hover:bg-white"}`}
                                    >
                                        {filter.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex flex-col items-start gap-1 text-[11px] text-neutral-600 md:items-end">
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleFindNearMe}
                                    disabled={isLocating}
                                    className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-4 py-2 text-xs text-neutral-800 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isLocating ? "Hentar posisjon …" : "Finn utsal nær meg"}
                                </button>
                                {(userLocation || activeFilter !== "alle") && (
                                    <button
                                        type="button"
                                        onClick={handleResetFilters}
                                        className="inline-flex items-center justify-center rounded-full border border-transparent px-3 py-1.5 text-[11px] text-neutral-600 hover:bg-black/5"
                                    >
                                        Nullstill filter
                                    </button>
                                )}
                            </div>
                            {userLocation && (
                                <span>
                                    Viser utsal innan ca. {searchRadiusKm} km frå deg.
                                </span>
                            )}
                            {geoError && (
                                <span className="text-red-600">
                                    {geoError}
                                </span>
                            )}
                        </div>
                    </div>
                </section>

                {/* List of outlets */}
                <section
                    className={`mx-auto max-w-6xl px-4 pb-16 pt-8 ${visibleOutlets.length === 0 ? "min-h-[40vh]" : ""
                        }`}
                >
                    {loading ? (
                        <p className="text-sm text-neutral-600">Laster utsal …</p>
                    ) : visibleOutlets.length === 0 ? (
                        userLocation && nearestWithDistance ? (
                            <div className="space-y-4">
                                {!showNearest && (
                                    <div className="max-w-prose space-y-2 text-sm text-neutral-600">
                                        <p>
                                            Vi fann ingen utsal innan ca. {searchRadiusKm} km frå deg
                                            for dette filteret.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowNearest(true)}
                                            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-xs font-medium text-neutral-800 hover:bg-black/5"
                                        >
                                            Vis næraste utsal
                                        </button>
                                    </div>
                                )}
                                {showNearest && (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <article
                                            key={nearestWithDistance.outlet.id}
                                            className="flex h-full flex-col justify-between rounded-[20px] border border-[color:var(--line)] bg-white/70 p-5"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <h2 className="text-sm font-medium text-neutral-900">
                                                        {nearestWithDistance.outlet.name}
                                                    </h2>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(nearestWithDistance.outlet.kinds.includes("safteri") ||
                                                            nearestWithDistance.outlet.kinds.includes("begge")) && (
                                                                <span className="rounded-full bg-[rgba(178,74,155,0.10)] px-2 py-0.5 text-[10px] font-medium text-[#8E3B7C]">
                                                                    Safteri
                                                                </span>
                                                            )}
                                                        {(nearestWithDistance.outlet.kinds.includes("bryggeri") ||
                                                            nearestWithDistance.outlet.kinds.includes("begge")) && (
                                                                <span className="rounded-full bg-[rgba(176,122,42,0.10)] px-2 py-0.5 text-[10px] font-medium text-[#7E5520]">
                                                                    Bryggeri
                                                                </span>
                                                            )}
                                                    </div>
                                                </div>

                                                <p className="mt-1 text-xs text-neutral-600">
                                                    {nearestWithDistance.outlet.city} · {nearestWithDistance.outlet.type}
                                                </p>

                                                {nearestWithDistance.outlet.address && (
                                                    <p className="mt-1 text-[11px] text-neutral-500">
                                                        {nearestWithDistance.outlet.address}
                                                    </p>
                                                )}
                                                <p className="mt-1 text-[11px] text-neutral-500">
                                                    Omtrent {Math.round(nearestWithDistance.distance)} km unna
                                                </p>
                                            </div>

                                            {nearestWithDistance.outlet.links &&
                                                nearestWithDistance.outlet.links.length > 0 && (
                                                    <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-neutral-700">
                                                        {nearestWithDistance.outlet.links.map((link, index) => (
                                                            <a
                                                                key={`${nearestWithDistance.outlet.id}-link-${index}`}
                                                                href={link.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] px-3 py-1 hover:bg-black/5"
                                                            >
                                                                <span>{link.label || "Lenkje"}</span>
                                                                <span aria-hidden="true">↗</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                        </article>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-neutral-600">
                                Ingen utsal å vise for dette filteret enno.
                            </p>
                        )
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {visibleOutlets.map((outlet) => (
                                <article
                                    key={outlet.id}
                                    className="flex h-full flex-col justify-between rounded-[20px] border border-[color:var(--line)] bg-white/70 p-5"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <h2 className="text-sm font-medium text-neutral-900">
                                                {outlet.name}
                                            </h2>
                                            <div className="flex flex-wrap gap-1">
                                                {(outlet.kinds.includes("safteri") ||
                                                    outlet.kinds.includes("begge")) && (
                                                        <span className="rounded-full bg-[rgba(178,74,155,0.10)] px-2 py-0.5 text-[10px] font-medium text-[#8E3B7C]">
                                                            Safteri
                                                        </span>
                                                    )}
                                                {(outlet.kinds.includes("bryggeri") ||
                                                    outlet.kinds.includes("begge")) && (
                                                        <span className="rounded-full bg-[rgba(176,122,42,0.10)] px-2 py-0.5 text-[10px] font-medium text-[#7E5520]">
                                                            Bryggeri
                                                        </span>
                                                    )}
                                            </div>
                                        </div>

                                        <p className="mt-1 text-xs text-neutral-600">
                                            {outlet.city} · {outlet.type}
                                        </p>

                                        {outlet.address && (
                                            <p className="mt-1 text-[11px] text-neutral-500">
                                                {outlet.address}
                                            </p>
                                        )}
                                        {userLocation &&
                                            typeof outlet.lat === "number" &&
                                            typeof outlet.lng === "number" && (
                                                <p className="mt-1 text-[11px] text-neutral-500">
                                                    Omtrent{" "}
                                                    {Math.round(
                                                        getDistanceKm(
                                                            userLocation.lat,
                                                            userLocation.lng,
                                                            outlet.lat,
                                                            outlet.lng
                                                        )
                                                    )}{" "}
                                                    km unna
                                                </p>
                                            )}
                                    </div>

                                    {outlet.links && outlet.links.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-neutral-700">
                                            {outlet.links.map((link, index) => (
                                                <a
                                                    key={`${outlet.id}-link-${index}`}
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] px-3 py-1 hover:bg-black/5"
                                                >
                                                    <span>{link.label || "Lenkje"}</span>
                                                    <span aria-hidden="true">↗</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>

            </div>

            {/* Footer */}
            <footer id="kontakt" className="mt-auto border-t border-[color:var(--line)]">
                <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-600">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p>
                            © {new Date().getFullYear()} Valldal
                        </p>
                        <ContactDisplay
                            fallbackContact={siteContent.contact}
                            variant="inline"
                        />
                    </div>
                </div>
            </footer>
        </main>
    );
}