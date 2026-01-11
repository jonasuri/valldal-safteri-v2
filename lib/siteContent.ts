export const siteContent = {
    // Shared across the whole site
    openingHours: {
        season: "Vinter",
        hours: "Laurdag kl. 11–16",
        note:
            "Når vi er i produksjon held vi ofte lyset på – ta gjerne turen innom. Du kan òg ringe oss, så avtaler vi tidspunkt.",
    },

    contact: {
        address: "Syltegata 15",
        phone: "994 69 704",
        phoneHref: "tel:99469704",
        email: "post@valldalsafteri.no",
        emailHref: "mailto:post@valldalsafteri.no",
    },

    // Landing page content
    landing: {
        header: {
            logoAlt: "Valldal",
        },

        hero: {
            kicker: "Handverk frå Valldal",
            titleLines: ["Tradisjon", "for framtida."],
            subtitle: "Eit safteri og bryggeri i Valldal, bygd på handverk og tid.",
            image: {
                src: "/hero2.JPEG",
                alt: "Landskap frå Valldal",
            },
            mantra: "Natur · reine råvarer · handverk",
        },

        cards: {
            safteri: {
                title: "Safteri",
                description:
                    "Saft, sylte, gele og most – laga av reine råvarer, med ro og presisjon i kvart ledd.",
            },
            bryggeri: {
                title: "Bryggeri",
                badge: "18+",
                description:
                    "Handverksbrygg med tradisjon og presisjon – utvikla med respekt for råvara og prosessen.",
            },
        },

        visit: {
            title: "Besøk",
            intro:
                "Besøk Valldal Safteri og Bryggeri. I butikken finn du eit utval frå begge univers – saft og sylte, og brygg for dei over 18.",
            openingHoursLabel: "Åpningstider",
            seasonStyle: "paren", // "paren" = Åpningstider (Vinter) / "colon" = Vinter: ...
        },

        about: {
            title: "Om Valldal",
            textLines: [
                "Familien tok over Valldal Safteri for tre år sidan, og har sidan bygd vidare med Valldal Bryggeri.",
                "Same stad. Same handverk.",
                "Eit nytt uttrykk – med respekt for tradisjonane vi forvaltar.",
            ],
        },
    },

    // Safteri page content
    safteri: {
        hero: {
            kicker: "Valldal Safteri",
            titleLines: ["Reine råvarer,", "handverk,", "tid."],
            subtitle:
                "Saft, sylte, gele og most – laga av reine råvarer, med ro og presisjon i kvart ledd.",
            mantra: "Bær · frukt · tradisjon",
        },

        kortFortalt: {
            title: "Kort fortalt",
            bullets: [
                { strong: "Sidan 1919:", text: "saft og syltetøy laga med respekt for råvara og tradisjonen." },
                { strong: "Heile bær og frukt:", text: "utan unødvendige snarvegar." },
                { strong: "For kvardag og fest:", text: "like naturleg på frukostbordet som til gåve." },
            ],
        },

        utval: {
            title: "Utval",
            intro:
                "Eit utval av saft, sylte, gele og most – laga i små seriar, og forma av sesong og råvare.",
            categories: [
                {
                    title: "Saft",
                    description:
                        "Reine smakar, pressa av frukt og bær – laga for å drikkast, ikkje sparast.",
                },
                {
                    title: "Sylte og gelé",
                    description:
                        "Heile bær og frukt, varsam sødme og struktur – frå frukostbord til dessert.",
                },
                {
                    title: "Frisk",
                    description: "Ferdig blanda saft – klar til å drikkast.",
                },
                {
                    title: "Rein",
                    description: "Pressa frukt – ikkje noko tilsett, klar til å drikkast.",
                },
            ],
            note:
                "Saus ligg under «Sylte og gele» (få produkt, same familie).",
        },

        visit: {
            title: "Besøk",
            intro: "Besøk oss i Valldal. Her finn du vår butikk og eit utval av produkta våre.",
            openingHoursLabel: "Åpningstider",
            storeTitle: "Butikk",
            storeText:
                "I butikken finn du eit utval av saft, sylte og gele – og når det passar, også brygg frå Valldal Bryggeri.",
            storeNote:
                "Vi oppdaterer utvalet gjennom året etter sesong og råvare. Spør oss gjerne dersom du leitar etter noko spesielt.",
        },

        about: {
            title: "Om safteriet",
            paragraphs: [
                "Sidan 1919 har Valldal Safteri vore ein del av frukt- og bærtradisjonen i bygda. Gjennom generasjonar har råvara, staden og handverket vore viktigare enn tempo og volum.",
                "I dag byggjer vi vidare på det same grunnlaget. Vi arbeider i små seriar, med respekt for sesong og råvare, og let smaken styre prosessen – ikkje motsett.",
                "Produkta våre er laga for å brukast – i kvardagen, til fest og som gåve. Enkle i uttrykket, men gjennomarbeidde i innhald.",
            ],
        },
    },

    // Bryggeri page content (fill in/adjust as you refine)
    bryggeri: {
        hero: {
            kicker: "Valldal Bryggeri",
            titleLines: ["Handverksbrygg", "laga", "med presisjon."],
            subtitle:
                "Øl og sider brygga i små seriar, med kontroll i kvar del av prosessen – frå råvare til ferdig brygg.",
            badge: "18+",
        },

        kortFortalt: {
            title: "Kort fortalt",
            bullets: [
                {
                    strong: "Små seriar:",
                    text: "brygga i avgrensa batchar for jamn kvalitet og presis kontroll.",
                },
                {
                    strong: "Reine uttrykk:",
                    text: "tydeleg balanse, utan unødvendige snarvegar."
                },
                {
                    strong: "Øl og sider:",
                    text: "forma av råvare, sesong og tid – med respekt for prosessen.",
                },
            ],
        },

        utval: {
            title: "Utval",
            intro:
                "Eit utval av øl og sider – brygga i små seriar, forma av sesong og råvare.",
            categories: [
                { title: "Øl", description: "Handverksøl med rein balanse og tydeleg karakter." },
                { title: "Sider", description: "Sider med tydelig frukt og presis avslutning" },
            ],
        },

        visit: {
            title: "Besøk",
            intro:
                "Besøk oss i Valldal. Her finn du vår butikk og eit utval av produkta våre.",
            openingHoursLabel: "Åpningstider",
            storeTitle: "Butikk",
            storeText:
                "I butikken finn du òg eit utval frå Valldal Bryggeri – og også varer frå Valldal Safteri",
            storeNote:
                "Vi oppdaterer utvalet gjennom året etter sesong og råvare. Spør oss gjerne dersom du leitar etter noko spesielt.",
        },

        about: {
            title: "Om bryggeriet",
            paragraphs: [
                "Valldal Bryggeri er eit nytt kapittel på same stad. Bryggeriet vart etablert for å utforske eit anna uttrykk – med den same respekten for råvare, prosess og tid.",
                "Vi bryggar i små seriar, med presisjon i kvar del av arbeidet. Smak, balanse og stabil kvalitet er viktigare enn volum og tempo.",
                "Dette er brygg laga for å drikkast med merksemd – forma av råvare, sesong og handverk.",
            ],
        },
    },
} as const;

export type SiteContent = typeof siteContent;
