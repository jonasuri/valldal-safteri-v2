"use client";

import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { siteContent } from "../../lib/siteContent";
import { OpeningHoursDisplay } from "../components/OpeningHoursDisplay";
import { ContactDisplay } from "../components/ContactDisplay";

const STORAGE_KEY = "valldal_bryggeri_18plus_ok";

export default function BryggeriPage() {
    const [ok, setOk] = useState<boolean | null>(null);
    const [heroKicker, setHeroKicker] = useState<string>(siteContent.bryggeri.hero.kicker);
    const [heroTitle, setHeroTitle] = useState<string>(
        siteContent.bryggeri.hero.titleLines.join("\n")
    );
    const [heroSubtitle, setHeroSubtitle] = useState<string>(
        siteContent.bryggeri.hero.subtitle
    );
    const [heroWords, setHeroWords] = useState<string[]>(["Malt", "gjær", "tid"]);
    const [kortTitle, setKortTitle] = useState<string>(siteContent.bryggeri.kortFortalt.title);
    const [kortBullets, setKortBullets] = useState<string[]>(
        siteContent.bryggeri.kortFortalt.bullets.map((b) => {
            const strong = b.strong?.trim?.() ?? "";
            const text = b.text?.trim?.() ?? "";
            return text ? `${strong}: ${text}` : strong;
        })
    );

    const [olDescription, setOlDescription] = useState<string>(
        siteContent.bryggeri.utval.categories[0]?.description ?? ""
    );
    const [siderDescription, setSiderDescription] = useState<string>(
        siteContent.bryggeri.utval.categories[1]?.description ?? ""
    );
    const [visitIntro, setVisitIntro] = useState<string>(
        siteContent.bryggeri.visit.intro
    );
    const [storeText, setStoreText] = useState<string>(
        siteContent.bryggeri.visit.storeText
    );
    const [aboutText, setAboutText] = useState<string>(
        siteContent.bryggeri.about.paragraphs.join("\n\n")
    );

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            setOk(stored === "true");
        } catch {
            setOk(false);
        }
    }, []);

    useEffect(() => {
        const fetchBryggeriHero = async () => {
            try {
                const ref = doc(db, "content", "global");
                const snap = await getDoc(ref);
                if (!snap.exists()) return;
                const data = snap.data();

                if (typeof data.bryggeriHeroKicker === "string" && data.bryggeriHeroKicker.trim()) {
                    setHeroKicker(data.bryggeriHeroKicker);
                }
                if (typeof data.bryggeriHeroTitle === "string" && data.bryggeriHeroTitle.trim()) {
                    setHeroTitle(data.bryggeriHeroTitle);
                }
                if (typeof data.bryggeriHeroSubtitle === "string" && data.bryggeriHeroSubtitle.trim()) {
                    setHeroSubtitle(data.bryggeriHeroSubtitle);
                }
                if (Array.isArray(data.bryggeriHeroWords)) {
                    const cleaned = data.bryggeriHeroWords
                        .filter((v: unknown) => typeof v === "string")
                        .slice(0, 3);
                    while (cleaned.length < 3) {
                        cleaned.push("");
                    }
                    setHeroWords(cleaned as string[]);
                }
                if (typeof data.bryggeriKortTitle === "string" && data.bryggeriKortTitle.trim()) {
                    setKortTitle(data.bryggeriKortTitle);
                }
                if (Array.isArray(data.bryggeriKortBullets)) {
                    const loadedBullets = data.bryggeriKortBullets
                        .filter((v: unknown) => typeof v === "string")
                        .map((v: string) => v.trim())
                        .filter((v: string) => v.length > 0);
                    if (loadedBullets.length > 0) {
                        setKortBullets(loadedBullets);
                    }
                }

                if (typeof data.bryggeriOlDescription === "string" && data.bryggeriOlDescription.trim()) {
                    setOlDescription(data.bryggeriOlDescription);
                }

                if (typeof data.bryggeriSiderDescription === "string" && data.bryggeriSiderDescription.trim()) {
                    setSiderDescription(data.bryggeriSiderDescription);
                }

                if (typeof data.bryggeriVisitText === "string" && data.bryggeriVisitText.trim()) {
                    setVisitIntro(data.bryggeriVisitText);
                }
                if (typeof data.bryggeriStoreText === "string" && data.bryggeriStoreText.trim()) {
                    setStoreText(data.bryggeriStoreText);
                }
                if (typeof data.bryggeriAboutText === "string" && data.bryggeriAboutText.trim()) {
                    setAboutText(data.bryggeriAboutText);
                }
            } catch (err) {
                console.error("Feil ved henting av bryggeri-hero:", err);
            }
        };

        fetchBryggeriHero();
    }, []);

    const aboutParagraphs = aboutText
        ? aboutText.trim().split(/\n{2,}/)
        : [];

    // Loading state while reading localStorage
    if (ok === null) {
        return (
            <div className="min-h-screen grid place-items-center text-sm text-neutral-600">
                Laster …
            </div>
        );
    }

    // 18+ gate
    if (!ok) {
        return (
            <main className="min-h-screen text-neutral-900">
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
                            <Link className="hover:text-neutral-900" href="/safteri">
                                Safteri
                            </Link>
                            <span className="font-semibold text-neutral-900">
                                Bryggeri <span className="ml-1 text-xs opacity-70">18+</span>
                            </span>
                        </nav>
                    </div>
                </header>

                <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl place-items-center px-4 py-10">
                    <div className="w-full max-w-md rounded-[28px] border border-[color:var(--line)] bg-white/35 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
                            Aldersgrense
                        </p>
                        <h1
                            className="mt-2 text-2xl tracking-tight"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            Dette innhaldet er for personar over 18 år
                        </h1>
                        <p className="mt-3 text-sm leading-7 text-neutral-600">
                            Ved å gå vidare stadfestar du at du er over 18 år.
                        </p>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => {
                                    localStorage.setItem(STORAGE_KEY, "true");
                                    setOk(true);
                                }}
                                className="flex-1 rounded-full bg-neutral-900 px-5 py-2 text-sm text-[color:var(--paper)] hover:bg-neutral-800"
                            >
                                Eg er over 18
                            </button>

                            <Link
                                href="/"
                                className="flex-1 rounded-full border border-[color:var(--line)] px-5 py-2 text-center text-sm text-neutral-800 hover:bg-black/[0.03]"
                            >
                                Tilbake
                            </Link>
                        </div>

                        <p className="mt-4 text-xs text-neutral-500">
                            (Valet blir lagra på denne eininga.)
                        </p>
                    </div>
                </section>
            </main>
        );
    }

    // Main bryggeri page (post-gate)
    return (
        <main
            className="min-h-screen text-neutral-900"
            style={
                {
                    // Bryggeri accent (amber / malt)
                    "--accent": "#B07A2A",
                    "--accentDark": "#7E5520",
                    "--accentSoft": "rgba(176, 122, 42, 0.14)",
                    "--accentSurface": "rgba(176, 122, 42, 0.06)",
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

                        <Link className="hover:text-neutral-900" href="/safteri">
                            Safteri
                        </Link>

                        <Link
                            className="font-semibold text-neutral-900 relative after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:bg-neutral-900/70"
                            href="/bryggeri"
                            aria-current="page"
                        >
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
                            {heroTitle.split(/\r?\n/).map((line, idx, arr) => (
                                <span key={idx}>
                                    {line}
                                    {idx < arr.length - 1 && <br />}
                                </span>
                            ))}
                        </h1>

                        <p className="mt-5 max-w-prose text-[15px] leading-7 text-neutral-600">
                            {heroSubtitle}
                        </p>

                        <div className="mt-7">
                            <a
                                href="#besok"
                                className="inline-block min-w-[200px] text-center rounded-full border border-[color:var(--line)] bg-[color:var(--accentSurface)] px-5 py-2 text-sm transition will-change-transform hover:-translate-y-0.5 hover:bg-[color:var(--accentSoft)] hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)]"
                                style={{ color: "var(--accentDark)" }}
                            >
                                Besøk & åpningstider
                            </a>
                        </div>

                        <div className="mt-10 hidden md:flex justify-center">
                            <p className="text-xs tracking-[0.22em] uppercase text-neutral-600">
                                {heroWords
                                    .filter((w) => w.trim().length > 0)
                                    .map((word, idx, arr) => (
                                        <span key={idx}>
                                            {word}
                                            {idx < arr.length - 1 && " · "}
                                        </span>
                                    ))}
                            </p>
                        </div>
                    </div>

                    <div className="md:col-span-5 lg:col-span-6 mt-2 md:mt-0">
                        <div className="w-full p-7 md:p-10">
                            <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
                                {kortTitle}
                            </p>
                            <ul className="mt-5 space-y-4 text-sm leading-7 text-neutral-700">
                                {kortBullets
                                    .map((raw) => raw.trim())
                                    .filter((raw) => raw.length > 0)
                                    .map((raw, idx) => {
                                        const [strongPart, ...rest] = raw.split(":");
                                        const strong = strongPart.trim();
                                        const text = rest.join(":").trim();
                                        return (
                                            <li key={idx}>
                                                <span className="text-neutral-900 font-semibold">{strong}</span>
                                                {text && <> {text}</>}
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Utval */}
            <section id="utval" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
                <div className="flex items-end justify-between gap-6">
                    <div>
                        <h2
                            className="text-3xl tracking-tight md:text-4xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                        >
                            {siteContent.bryggeri.utval.title}
                        </h2>
                    </div>
                </div>
                {/*
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {siteContent.bryggeri.utval.categories.map((cat, idx) => (
                        <Link
                            key={idx}
                            href={cat.title.toLowerCase().includes("sider")
                                ? "/bryggeri/products?category=sider"
                                : "/bryggeri/products?category=ol"}
                            className="group block rounded-[28px] border border-[color:var(--line)] bg-[color:var(--accentSurface)] p-7 transition will-change-transform cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)] hover:bg-[color:var(--accentSoft)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/20"
                        >
                            <h3
                                className="text-2xl tracking-tight md:text-3xl"
                                style={{ fontFamily: "var(--font-serif)" }}
                            >
                                {cat.title}
                            </h3>
                            <p className="mt-3 text-sm leading-7 text-neutral-700">
                                {cat.title.toLowerCase().includes("sider") ? siderDescription : olDescription}
                            </p>
                        </Link>
                    ))}
                </div>
                */}

                <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {siteContent.bryggeri.utval.categories.map((cat, idx) => (
                        <div
                            key={idx}
                            className="relative rounded-[28px] border border-[color:var(--line)] bg-[color:var(--accentSurface)] p-7 opacity-60"
                        >
                            <div className="absolute right-5 top-5 rounded-full border border-[color:var(--line)] bg-white/70 px-3 py-1 text-[11px] font-medium text-neutral-800">
                                Kjem snart
                            </div>

                            <h3
                                className="text-2xl tracking-tight md:text-3xl"
                                style={{ fontFamily: "var(--font-serif)" }}
                            >
                                {cat.title}
                            </h3>
                            <p className="mt-3 text-sm leading-7 text-neutral-700">
                                {cat.title.toLowerCase().includes("sider") ? siderDescription : olDescription}
                            </p>

                            <div className="mt-5 text-xs text-neutral-600">
                                Produktsider kjem snart.
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Divider */}
            <div className="mx-auto max-w-6xl px-4">
                <div className="h-px w-full bg-[color:var(--line)]" />
            </div>

            {/* Besøk */}
            <section id="besok" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
                <div className="py-2 md:py-6">
                    <h2
                        className="text-3xl tracking-tight md:text-4xl"
                        style={{ fontFamily: "var(--font-serif)" }}
                    >
                        {siteContent.bryggeri.visit.title}
                    </h2>
                    <p className="mt-3 max-w-prose text-sm leading-7 text-neutral-600">
                        {visitIntro}
                    </p>
                </div>

                <div className="mt-10 grid gap-10 md:grid-cols-2">
                    <div>
                        <h3 className="text-lg font-medium text-neutral-900">{siteContent.bryggeri.visit.openingHoursLabel}</h3>
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
                                href="/utsal?from=bryggeri&filter=bryggeri"
                                className="mt-1 inline-flex items-center text-xs font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
                            >
                                Sjå utsal →
                            </Link>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium text-neutral-900">{siteContent.bryggeri.visit.storeTitle}</h3>
                        <div className="mt-4 h-px w-20 bg-[color:var(--accent)]/25" />
                        <p className="mt-4 text-sm leading-7 text-neutral-600">
                            {storeText
                                .split(/\n{2,}/)
                                .filter((block) => block.trim().length > 0)
                                .map((block, idx) => (
                                    <span key={idx} className="block mb-3">
                                        {block.split(/\n/).map((line, lineIdx, linesArr) => (
                                            <span key={lineIdx}>
                                                {line}
                                                {lineIdx < linesArr.length - 1 && <br />}
                                            </span>
                                        ))}
                                    </span>
                                ))}
                        </p>
                    </div>
                </div>

                <div className="mt-12 h-px w-full bg-[color:var(--line)]" />

                <div className="mt-12">
                    <h2
                        className="text-3xl tracking-tight md:text-4xl"
                        style={{ fontFamily: "var(--font-serif)" }}
                    >
                        {siteContent.bryggeri.about.title}
                    </h2>

                    {aboutParagraphs.length === 0 ? (
                        <p className="mt-3 max-w-prose text-sm leading-7 text-neutral-600">
                            {/* Valfri fallback-tekst kan leggjast inn her om ønskjeleg når feltet er tomt */}
                        </p>
                    ) : (
                        <div className="mt-3 space-y-3 max-w-prose text-sm leading-7 text-neutral-600">
                            {aboutParagraphs.map((block, idx) => (
                                <p key={idx}>
                                    {block.split("\n").map((line, lineIdx, all) => (
                                        <span key={lineIdx}>
                                            {line}
                                            {lineIdx < all.length - 1 && <br />}
                                        </span>
                                    ))}
                                </p>
                            ))}
                        </div>
                    )}

                    <div className="mt-12 h-px w-full bg-[color:var(--line)]" />

                    <div className="mt-8 flex items-center justify-between text-sm text-neutral-700">
                        <Link className="hover:text-neutral-900 hover:underline underline-offset-4" href="/">
                            ← Tilbake til forsida
                        </Link>
                        <Link className="hover:text-neutral-900 hover:underline underline-offset-4" href="/safteri">
                            Til Safteri →
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="border-t border-[color:var(--line)]">
                <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-600">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p>© {new Date().getFullYear()} Valldal Bryggeri</p>
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