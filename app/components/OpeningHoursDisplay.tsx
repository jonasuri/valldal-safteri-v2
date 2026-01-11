"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type DayKey =
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";

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

type OpeningHoursDisplayProps = {
    fallbackSeason: string;
    fallbackHoursLine: string;
    note: string;
};

export function OpeningHoursDisplay({
    fallbackSeason,
    fallbackHoursLine,
    note,
}: OpeningHoursDisplayProps) {
    const [season, setSeason] = useState<string>(fallbackSeason);
    const [lines, setLines] = useState<string[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [noteText, setNoteText] = useState<string>(note);

    const [closed, setClosed] = useState(false);
    const [closedMessage, setClosedMessage] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const ref = doc(db, "content", "global");
                const snap = await getDoc(ref);

                if (snap.exists()) {
                    const data = snap.data() as any;

                    if (typeof data.openingClosed === "boolean") {
                        setClosed(data.openingClosed);
                    }

                    if (typeof data.openingClosedMessage === "string") {
                        setClosedMessage(data.openingClosedMessage);
                    }

                    if (typeof data.openingSeason === "string" && data.openingSeason.trim()) {
                        setSeason(data.openingSeason.trim());
                    }

                    if (!data.openingClosed && data.openingHours && typeof data.openingHours === "object") {
                        const list: string[] = [];

                        for (const day of dayOrder) {
                            const dayData = data.openingHours[day];
                            if (
                                dayData &&
                                typeof dayData === "object" &&
                                typeof dayData.from === "string" &&
                                typeof dayData.to === "string" &&
                                dayData.from &&
                                dayData.to
                            ) {
                                const from = dayData.from.slice(0, 5);
                                const to = dayData.to.slice(0, 5);
                                list.push(`${dayLabels[day]} ${from}–${to}`);
                            }
                        }

                        if (list.length > 0) {
                            setLines(list);
                        }
                    }

                    if (typeof data.openingNote === "string") {
                        setNoteText(data.openingNote);
                    }
                }
            } catch (err) {
                console.error("Klarte ikkje å hente åpningstider:", err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [fallbackSeason]);

    return (
        <div className="mt-6 max-w-prose text-sm leading-7 text-neutral-700">
            {closed ? (
                <p>
                    <span className="font-medium text-neutral-900">Midlertidig stengt:</span>{" "}
                    {closedMessage || "Vi held for tida stengt."}
                </p>
            ) : (
                <>
                    <p>
                        <span className="font-medium text-neutral-900">
                            Åpningstider{season ? ` (${season})` : ""}:
                        </span>
                        <br />
                        {loading && !lines
                            ? fallbackHoursLine
                            : lines && lines.length > 0
                                ? lines.map((line, i) => (
                                    <span key={i}>
                                        {line}
                                        {i < lines.length - 1 ? <br /> : null}
                                    </span>
                                ))
                                : fallbackHoursLine}
                    </p>

                    {noteText.trim() && <p className="mt-4">{noteText}</p>}
                </>
            )}
        </div>
    );
}