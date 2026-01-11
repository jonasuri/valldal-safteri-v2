"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { siteContent } from "../lib/siteContent";
import { OpeningHoursDisplay } from "./components/OpeningHoursDisplay";
import { ContactDisplay } from "./components/ContactDisplay";

export default function HomePage() {
  type LandingHeroState = {
    kicker: string;
    title: string;
    subtitle: string;
    images: string[];
    words: string[];
  };

  const fallbackSafteriDescription = siteContent.landing.cards.safteri.description;
  const fallbackBryggeriDescription = siteContent.landing.cards.bryggeri.description;

  const fallbackHero: LandingHeroState = {
    kicker: siteContent.landing.hero.kicker,
    title: siteContent.landing.hero.titleLines.join(" "),
    subtitle: siteContent.landing.hero.subtitle,
    images: [siteContent.landing.hero.image.src],
    words: siteContent.landing.hero.mantra
      .split("·")
      .map((w) => w.trim())
      .filter((w) => w.length > 0),
  };

  const fallbackAboutText = siteContent.landing.about.textLines.join(" ");

  const [hero, setHero] = useState<LandingHeroState>(fallbackHero);
  const [cardDescriptions, setCardDescriptions] = useState({
    safteri: fallbackSafteriDescription,
    bryggeri: fallbackBryggeriDescription,
  });
  const [visitIntro, setVisitIntro] = useState(siteContent.landing.visit.intro);
  const [aboutText, setAboutText] = useState(fallbackAboutText);

  useEffect(() => {
    let cancelled = false;

    async function loadHero() {
      try {
        const ref = doc(db, "content", "global");
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data() as any;

        const kicker =
          typeof data.landingHeroKicker === "string" && data.landingHeroKicker.trim()
            ? data.landingHeroKicker
            : fallbackHero.kicker;

        const title =
          typeof data.landingHeroTitle === "string" && data.landingHeroTitle.trim()
            ? data.landingHeroTitle
            : fallbackHero.title;

        const subtitle =
          typeof data.landingHeroSubtitle === "string" && data.landingHeroSubtitle.trim()
            ? data.landingHeroSubtitle
            : fallbackHero.subtitle;

        let safteriDescription = fallbackSafteriDescription;
        if (
          typeof data.landingSafteriDescription === "string" &&
          data.landingSafteriDescription.trim()
        ) {
          safteriDescription = data.landingSafteriDescription;
        }

        let bryggeriDescription = fallbackBryggeriDescription;
        if (
          typeof data.landingBryggeriDescription === "string" &&
          data.landingBryggeriDescription.trim()
        ) {
          bryggeriDescription = data.landingBryggeriDescription;
        }

        let images: string[] = [];
        if (Array.isArray(data.landingHeroImages)) {
          images = data.landingHeroImages.filter(
            (v: unknown): v is string => typeof v === "string" && v.trim() !== ""
          );
        }
        if (images.length === 0) {
          images = fallbackHero.images;
        }

        let words: string[] = fallbackHero.words;
        if (Array.isArray(data.landingHeroWords)) {
          const cleaned = data.landingHeroWords.filter(
            (v: unknown): v is string => typeof v === "string" && v.trim() !== ""
          );
          if (cleaned.length > 0) {
            words = cleaned.slice(0, 3);
          }
        }

        let effectiveVisitIntro = siteContent.landing.visit.intro;
        if (
          typeof data.landingVisitIntro === "string" &&
          data.landingVisitIntro.trim()
        ) {
          effectiveVisitIntro = data.landingVisitIntro;
        }

        let effectiveAboutText = fallbackAboutText;
        if (
          typeof data.landingAboutText === "string" &&
          data.landingAboutText.trim()
        ) {
          effectiveAboutText = data.landingAboutText;
        }

        if (!cancelled) {
          setHero({ kicker, title, subtitle, images, words });
          setCardDescriptions({
            safteri: safteriDescription,
            bryggeri: bryggeriDescription,
          });
          setVisitIntro(effectiveVisitIntro);
          setAboutText(effectiveAboutText);
        }
      } catch (err) {
        console.error("Klarte ikkje å laste hero-innhald for forsida:", err);
      }
    }

    loadHero();

    return () => {
      cancelled = true;
    };
  }, []);

  // Vel dagleg hero-bilete basert på dato
  let heroImageSrc = hero.images[0];
  if (hero.images.length > 1) {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const index = dayOfYear % hero.images.length;
    heroImageSrc = hero.images[index] ?? fallbackHero.images[0];
  }

  const displayWords =
    hero.words && hero.words.length > 0 ? hero.words : fallbackHero.words;

  return (
    <main className="min-h-screen text-neutral-900">
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
            <Link
              className="font-semibold text-neutral-900 relative after:absolute after:left-0 after:-bottom-1 after:h-px after:w-full after:bg-neutral-900/70"
              href="/"
              aria-current="page"
            >
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

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 md:pt-16">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-6 lg:col-span-5">
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-600">
              {hero.kicker}
            </p>

            <h1
              className="mt-4 text-5xl leading-[0.98] tracking-tight md:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {hero.title.split("\n").map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h1>

            <p className="mt-5 max-w-prose text-[15px] leading-7 text-neutral-600">
              {hero.subtitle}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href="/safteri"
                className="min-w-[140px] text-center rounded-full border px-5 py-2 text-sm transition will-change-transform bg-[color:var(--btnBg)] hover:bg-[color:var(--btnBgHover)] hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)]"
                style={
                  {
                    // subtle Safteri tint (matches the page vibe)
                    "--btnBg": "rgba(178, 74, 155, 0.10)",
                    "--btnBgHover": "rgba(178, 74, 155, 0.16)",
                    "--btnBorder": "rgba(178, 74, 155, 0.28)",
                    "--btnText": "#8E3B7C",
                    borderColor: "var(--btnBorder)",
                    color: "var(--btnText)",
                  } as CSSProperties
                }
              >
                Safteri
              </Link>

              <Link
                href="/bryggeri"
                className="min-w-[140px] text-center rounded-full border px-5 py-2 text-sm transition will-change-transform bg-[color:var(--btnBg)] hover:bg-[color:var(--btnBgHover)] hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)]"
                style={
                  {
                    // subtle Bryggeri tint (amber / malt)
                    "--btnBg": "rgba(176, 122, 42, 0.10)",
                    "--btnBgHover": "rgba(176, 122, 42, 0.16)",
                    "--btnBorder": "rgba(176, 122, 42, 0.28)",
                    "--btnText": "#7E5520",
                    borderColor: "var(--btnBorder)",
                    color: "var(--btnText)",
                  } as CSSProperties
                }
              >
                Bryggeri <span className="ml-1 text-xs opacity-80">18+</span>
              </Link>
            </div>

            <div className="mt-10 hidden md:flex justify-start">
              <p className="text-xs tracking-[0.22em] uppercase text-neutral-600">
                {displayWords
                  .filter((w) => w.trim().length > 0)
                  .map((word, index, arr) => (
                    <span key={index}>
                      {word}
                      {index < arr.length - 1 && (
                        <span aria-hidden="true"> · </span>
                      )}
                    </span>
                  ))}
              </p>
            </div>
          </div>

          <div className="md:col-span-6 lg:col-span-7">
            <div className="relative overflow-hidden rounded-[28px] bg-white/40">

              {/* Top fade + edge vignette */}
              <div className="pointer-events-none absolute inset-0 z-10">
                {/* top fade */}
                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/[0.10] to-transparent" />
                {/* very subtle edge vignette */}
                <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.14)]" />
              </div>

              {/* Image */}
              <div className="relative aspect-[16/11]">
                <Image
                  src={heroImageSrc}
                  alt={siteContent.landing.hero.image.alt}
                  fill
                  priority
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  className="object-cover saturate-[0.92] contrast-[0.98] select-none"
                  style={{ objectPosition: "50% 66%" }}
                />
              </div>

              {/* Prevent right-click save (best-effort; screenshots still possible) */}
              <div
                className="absolute inset-0 z-30"
                onContextMenu={(e) => e.preventDefault()}
              />

              {/* Bottom fade — lighter & shorter */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[color:var(--paper)]/70 to-transparent z-20" />



              {/* Border on top & sides only */}
              <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-[color:var(--line)] border-b-0 z-40" />
            </div>
          </div>
        </div>
      </section>

      {/* Brand split (integrated, but quiet) */}
      <section id="velg" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/safteri"
            className="group block rounded-[28px] bg-white/30 p-7 md:p-9 ring-1 ring-black/10 transition will-change-transform cursor-pointer hover:bg-white/40 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)] hover:ring-black/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/25"
          >
            <div className="flex items-center justify-between">
              <h2
                className="text-3xl tracking-tight md:text-4xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Safteri
              </h2>
              <span className="text-sm text-neutral-700 group-hover:text-neutral-900 group-hover:underline underline-offset-4">
                Gå til →
              </span>
            </div>
            <p className="mt-3 max-w-prose text-sm leading-7 text-neutral-600">
              {cardDescriptions.safteri}
            </p>
          </Link>

          <Link
            href="/bryggeri"
            className="group block rounded-[28px] bg-white/30 p-7 md:p-9 ring-1 ring-black/10 transition will-change-transform cursor-pointer hover:bg-white/40 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)] hover:ring-black/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black/25"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2
                  className="text-3xl tracking-tight md:text-4xl"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Bryggeri
                </h2>
                <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-xs text-neutral-600">
                  18+
                </span>
              </div>
              <span className="text-sm text-neutral-700 group-hover:text-neutral-900 group-hover:underline underline-offset-4">
                Gå til →
              </span>
            </div>
            <p className="mt-3 max-w-prose text-sm leading-7 text-neutral-600">
              {cardDescriptions.bryggeri}
            </p>
          </Link>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4"><div className="h-px w-full bg-[color:var(--line)]" /></div>

      {/* Sections so nav works */}
      <section id="besok" className="mx-auto max-w-6xl px-4 pb-10">
        <div className="py-10 md:py-14">
          <h2 className="text-3xl tracking-tight md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
            {siteContent.landing.visit.title}
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-7 text-neutral-600">
            {visitIntro}
          </p>
          <OpeningHoursDisplay
            fallbackSeason={siteContent.openingHours.season}
            fallbackHoursLine={siteContent.openingHours.hours}
            note={siteContent.openingHours.note}
          />
          <ContactDisplay fallbackContact={siteContent.contact} />
          <div className="mt-6">
            <h3
              className="text-sm font-semibold tracking-tight text-neutral-900 md:text-base"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Andre utsalsstadar
            </h3>

            <Link
              href="/utsal?from=forside"
              className="mt-1 inline-flex items-center text-xs font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
            >
              Sjå utsal →
            </Link>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4">
        <div className="h-px w-full bg-[color:var(--line)]" />
      </div>

      <section id="om" className="mx-auto max-w-6xl px-4 pb-14">
        <div className="py-10 md:py-14">
          <h2
            className="text-3xl tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {siteContent.landing.about.title}
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-7 text-neutral-600">
            {aboutText.split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        </div>
      </section>

      <footer id="kontakt" className="border-t border-[color:var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-600">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} Valldal</p>
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