"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { siteContent } from "../../lib/siteContent";
import { OpeningHoursDisplay } from "../components/OpeningHoursDisplay";
import { ContactDisplay } from "../components/ContactDisplay";

import { db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function SafteriPage() {
    const [heroKicker, setHeroKicker] = useState<string>(siteContent.safteri.hero.kicker);
    const [heroTitleLines, setHeroTitleLines] = useState<string[]>([
        ...siteContent.safteri.hero.titleLines,
    ]);
    const [heroSubtitle, setHeroSubtitle] = useState<string>(siteContent.safteri.hero.subtitle);
    const [heroMantra, setHeroMantra] = useState<string>(
        siteContent.safteri.hero.mantra
    );
    const [kortTitle, setKortTitle] = useState<string>(siteContent.safteri.kortFortalt.title);
    const [kortBullets, setKortBullets] = useState<any[]>([
        ...siteContent.safteri.kortFortalt.bullets,
    ]);
    const [visitIntro, setVisitIntro] = useState<string>(
        siteContent.safteri.visit.intro
    );
    const [visitDetails, setVisitDetails] = useState<string>(
        [
            siteContent.safteri.visit.storeText,
            siteContent.safteri.visit.storeNote,
        ]
            .filter(Boolean)
            .join("\n\n")
    );
    const [saftDescription, setSaftDescription] = useState<string>(
        siteContent.safteri.utval.categories[0]?.description ?? ""
    );
    const [sylteDescription, setSylteDescription] = useState<string>(
        siteContent.safteri.utval.categories[1]?.description ?? ""
    );
    const [friskDescription, setFriskDescription] = useState<string>(
        siteContent.safteri.utval.categories[2]?.description ?? ""
    );
    const [reinDescription, setReinDescription] = useState<string>(
        siteContent.safteri.utval.categories[3]?.description ?? ""
    );
    const [aboutText, setAboutText] = useState<string>(
        siteContent.safteri.about.paragraphs.join("\n\n")
    );

    useEffect(() => {
        const fetchSafteriHero = async () => {
            try {
                const ref = doc(db, "content", "global");
                const snap = await getDoc(ref);
                if (!snap.exists()) return;
                const data = snap.data();

                if (typeof data.safteriHeroKicker === "string" && data.safteriHeroKicker.trim().length > 0) {
                    setHeroKicker(data.safteriHeroKicker);
                }

                if (typeof data.safteriHeroTitle === "string" && data.safteriHeroTitle.trim().length > 0) {
                    const lines = data.safteriHeroTitle
                        .split("\n")
                        .map((l: string) => l.trim())
                        .filter((l: string) => l.length > 0);

                    const padded = [...lines];
                    while (padded.length < 3) {
                        padded.push("");
                    }
                    setHeroTitleLines(padded.slice(0, 3));
                }

                if (typeof data.safteriHeroSubtitle === "string" && data.safteriHeroSubtitle.trim().length > 0) {
                    setHeroSubtitle(data.safteriHeroSubtitle);
                }

                if (Array.isArray(data.safteriHeroWords)) {
                    const words = data.safteriHeroWords
                        .filter((v: unknown) => typeof v === "string")
                        .map((v: string) => v.trim())
                        .filter((v: string) => v.length > 0);
                    if (words.length > 0) {
                        setHeroMantra(words.join(" · "));
                    }
                }

                if (typeof data.safteriKortTitle === "string" && data.safteriKortTitle.trim().length > 0) {
                    setKortTitle(data.safteriKortTitle);
                }

                if (Array.isArray(data.safteriKortBullets)) {
                    setKortBullets(data.safteriKortBullets);
                }
                if (
                    typeof data.safteriVisitIntro === "string" &&
                    data.safteriVisitIntro.trim().length > 0
                ) {
                    setVisitIntro(data.safteriVisitIntro);
                }
                if (
                    typeof data.safteriVisitDetails === "string" &&
                    data.safteriVisitDetails.trim().length > 0
                ) {
                    setVisitDetails(data.safteriVisitDetails);
                }

                if (
                    typeof data.safteriSaftDescription === "string" &&
                    data.safteriSaftDescription.trim().length > 0
                ) {
                    setSaftDescription(data.safteriSaftDescription);
                }

                if (
                    typeof data.safteriSylteDescription === "string" &&
                    data.safteriSylteDescription.trim().length > 0
                ) {
                    setSylteDescription(data.safteriSylteDescription);
                }

                if (
                    typeof data.safteriFriskDescription === "string" &&
                    data.safteriFriskDescription.trim().length > 0
                ) {
                    setFriskDescription(data.safteriFriskDescription);
                }

                if (
                    typeof data.safteriReinDescription === "string" &&
                    data.safteriReinDescription.trim().length > 0
                ) {
                    setReinDescription(data.safteriReinDescription);
                }
                if (
                    typeof data.safteriAboutText === "string" &&
                    data.safteriAboutText.trim().length > 0
                ) {
                    setAboutText(data.safteriAboutText);
                }
            } catch (err) {
                console.error("Feil ved henting av Safteri-hero frå Firestore:", err);
            }
        };

        fetchSafteriHero();
    }, []);

    return (
        <main
            className="min-h-screen text-neutral-900"
            style={
                {
                    // Safteri accent (from the car wrap vibe)
                    "--accent": "#B24A9B",
                    "--accentDark": "#8E3B7C",
                    "--accentSoft": "rgba(178, 74, 155, 0.14)",
                    "--accentSurface": "rgba(178, 74, 155, 0.06)",
                } as CSSProperties
            }
        >
            {/* Header */}
            <header className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[color:var(--paper)]/85 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/logoDark.png"
                            alt={siteContent.landing.header.logoAlt}
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

                        <Link
                            className="font-semibold text-neutral-900 relative after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:bg-neutral-900/70"
                            href="/safteri"
                            aria-current="page"
                        >
                            Safteri
                        </Link>

                        <Link className="hover:text-neutral-900" href="/bryggeri">
                            Bryggeri <span className="ml-1 text-xs opacity-70">18+</span>
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section className="mx-auto max-w-6xl px-4 pt-10 md:pt-16">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-end">
                    <div className="md:col-span-7 lg:col-span-6">
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
                            {heroKicker}
                        </p>

                        <h1
                            className="mt-4 text-4xl leading-[0.98] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            {heroTitleLines[0]}
                            <br />
                            {heroTitleLines[1]}
                            <br />
                            {heroTitleLines[2]}
                        </h1>

                        <p className="mt-5 max-w-prose text-[15px] leading-7 text-neutral-600">
                            {heroSubtitle}
                        </p>

                        <div className="mt-7">
                            <a
                                href="#besok"
                                className="inline-block rounded-full border border-[color:var(--line)] bg-[color:var(--accentSurface)] px-5 py-2 text-sm text-neutral-800 transition will-change-transform hover:-translate-y-0.5 hover:bg-[color:var(--accentSoft)] hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)]"
                            >
                                Besøk & åpningstider
                            </a>
                        </div>

                        <div className="mt-10 hidden md:flex justify-center">
                            <p className="text-xs tracking-[0.22em] uppercase text-neutral-600">
                                {heroMantra}
                            </p>
                        </div>
                    </div>

                    <div className="md:col-span-5 lg:col-span-6 mt-2 md:mt-0">
                        <div className="w-full">
                            <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
                                {kortTitle}
                            </p>
                            <ul className="mt-5 space-y-4 text-sm leading-7 text-neutral-700">
                                {kortBullets.map((raw, idx) => {
                                    let label = "";
                                    let body = "";

                                    if (typeof raw === "string") {
                                        const [head, ...rest] = raw.split(":");
                                        label = head.trim();
                                        body = rest.join(":").trim();
                                    } else if (raw && typeof raw === "object") {
                                        const anyRaw = raw as any;
                                        label = String(anyRaw.label ?? "").trim();
                                        body = String(anyRaw.body ?? "").trim();
                                    }

                                    if (!label && !body) return null;

                                    return (
                                        <li key={idx}>
                                            {label && (
                                                <span className="text-neutral-900 font-semibold">
                                                    {label}
                                                    {body ? ":" : ""}
                                                </span>
                                            )}
                                            {body && (
                                                <>
                                                    {label ? " " : ""}
                                                    {body}
                                                </>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Utval */}
            <section id="utval" className="mx-auto max-w-6xl px-4 py-10 md:py-14">
                <div className="flex items-end justify-between gap-6">
                    <div>
                        <h2
                            className="text-3xl tracking-tight md:text-4xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            {siteContent.safteri.utval.title}
                        </h2>
                    </div>
                </div>

                {/* =========================
                   UTVAL (ORIGINAL) – BACKUP
                   (Uncomment when products are live)
                ========================= */}
                {/*
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {siteContent.safteri.utval.categories.map((cat, idx) => {
                        const href = cat.title.toLowerCase().includes("saft")
                            ? "/safteri/products?category=saft"
                            : cat.title.toLowerCase().includes("frisk")
                                ? "/safteri/products?category=frisk"
                                : cat.title.toLowerCase().includes("rein")
                                    ? "/safteri/products?category=rein"
                                    : "/safteri/products?category=sylte";

                        let description: string = cat.description;
                        if (idx === 0 && saftDescription.trim().length > 0) {
                            description = saftDescription;
                        } else if (idx === 1 && sylteDescription.trim().length > 0) {
                            description = sylteDescription;
                        } else if (idx === 2 && friskDescription.trim().length > 0) {
                            description = friskDescription;
                        } else if (idx === 3 && reinDescription.trim().length > 0) {
                            description = reinDescription;
                        }

                        return (
                            <Link
                                key={idx}
                                href={href}
                                className="group block rounded-[28px] border border-[color:var(--line)] bg-[color:var(--accentSurface)] p-7 transition will-change-transform cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)] hover:bg-[color:var(--accentSoft)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/20"
                            >
                                <h3
                                    className="text-2xl tracking-tight md:text-3xl"
                                    style={{ fontFamily: "var(--font-serif)" }}
                                >
                                    {cat.title}
                                </h3>
                                <p className="mt-3 text-sm leading-7 text-neutral-700">{description}</p>
                            </Link>
                        );
                    })}
                </div>
                */}

                {/* =========================
                   UTVAL – COMING SOON (TEMP)
                ========================= */}
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {["Saft", "Sylte og gelé", "Frisk", "Rein"].map((title) => (
                        <div
                            key={title}
                            className="relative rounded-[28px] border border-[color:var(--line)] bg-[color:var(--accentSurface)] p-7 opacity-60 grayscale cursor-not-allowed"
                            aria-disabled="true"
                        >
                            <span className="absolute right-5 top-5 rounded-full border border-[color:var(--line)] bg-[color:var(--paper)]/70 px-2 py-0.5 text-[11px] text-neutral-600">
                                Kjem snart
                            </span>

                            <h3
                                className="text-2xl tracking-tight md:text-3xl"
                                style={{ fontFamily: "var(--font-serif)" }}
                            >
                                {title}
                            </h3>

                            <p className="mt-3 text-sm leading-7 text-neutral-700">
                                Produktsida kjem snart.
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Besøk */}
            <section id="besok" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
                <div className="py-2 md:py-6">
                    <h2
                        className="text-3xl tracking-tight md:text-4xl"
                        style={{ fontFamily: "var(--font-serif)" }}
                    >
                        {siteContent.safteri.visit.title}
                    </h2>
                    <p className="mt-3 max-w-prose text-sm leading-7 text-neutral-600">
                        {visitIntro}
                    </p>
                </div>

                <div className="mt-10 grid gap-10 md:grid-cols-2">
                    <div>
                        <h3 className="text-lg font-medium text-neutral-900">{siteContent.safteri.visit.openingHoursLabel}</h3>
                        <div className="mt-4 h-px w-20 bg-[color:var(--accent)]/25" />
                        <OpeningHoursDisplay
                            fallbackSeason={siteContent.openingHours.season}
                            fallbackHoursLine={siteContent.openingHours.hours}
                            note={siteContent.openingHours.note}
                        />
                        <div className="mt-6">
                            <ContactDisplay fallbackContact={siteContent.contact} />
                        </div>
                        <div className="mt-6">
                            <h3
                                className="text-sm font-semibold tracking-tight text-neutral-900 md:text-base"
                                style={{ fontFamily: "var(--font-serif)" }}
                            >
                                Andre utsalsstadar
                            </h3>

                            <Link
                                href="/utsal?from=safteri&filter=safteri"
                                className="mt-1 inline-flex items-center text-xs font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
                            >
                                Sjå utsal →
                            </Link>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium text-neutral-900">{siteContent.safteri.visit.storeTitle}</h3>
                        <div className="mt-4 h-px w-20 bg-[color:var(--accent)]/25" />
                        {visitDetails
                            .split(/\r?\n\s*\r?\n/)
                            .map((paragraph, idx) => (
                                <p
                                    key={idx}
                                    className={`mt-4 text-sm leading-7 ${idx === 0 ? "text-neutral-600" : "text-neutral-700"}`}
                                >
                                    {paragraph
                                        .split(/\r?\n/)
                                        .map((line, i) => (
                                            <span key={i}>
                                                {line}
                                                {i < paragraph.split(/\r?\n/).length - 1 && <br />}
                                            </span>
                                        ))}
                                </p>
                            ))}
                    </div>
                </div>

                <div className="mt-12 h-px w-full bg-[color:var(--line)]" />
            </section>

            {/* Om safteriet */}
            <section className="mx-auto max-w-6xl px-4 pb-14">
                <div className="py-2 md:py-6">
                    <h2
                        className="text-3xl tracking-tight md:text-4xl"
                        style={{ fontFamily: "var(--font-serif)" }}
                    >
                        {siteContent.safteri.about.title}
                    </h2>

                    {aboutText
                        .split(/\r?\n\s*\r?\n/)
                        .map((paragraph, idx) => (
                            <p
                                key={idx}
                                className={`${idx === 0 ? "mt-3" : "mt-4"} max-w-prose text-sm leading-7 text-neutral-600`}
                            >
                                {paragraph.split(/\r?\n/).map((line, i, arr) => (
                                    <span key={i}>
                                        {line}
                                        {i < arr.length - 1 && <br />}
                                    </span>
                                ))}
                            </p>
                        ))}

                    <div className="mt-12 h-px w-full bg-[color:var(--line)]" />

                    <div className="mt-8 flex items-center justify-between text-sm text-neutral-700">
                        <Link className="hover:text-neutral-900 hover:underline underline-offset-4" href="/">
                            ← Tilbake til forsida
                        </Link>
                        <Link className="hover:text-neutral-900 hover:underline underline-offset-4" href="/bryggeri">
                            Til Bryggeri →
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="border-t border-[color:var(--line)]">
                <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-600">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p>© {new Date().getFullYear()} Valldal Safteri</p>
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