"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type ContactDisplayProps = {
    fallbackContact: {
        address: string;
        phone: string;
        phoneHref: string;
        email: string;
        emailHref: string;
    };
    /**
     * block  = stacked layout (default, used in sections)
     * inline = single-line layout (used in footer)
     */
    variant?: "block" | "inline";
};

export function ContactDisplay({ fallbackContact, variant = "block" }: ContactDisplayProps) {
    const [address, setAddress] = useState<string>(fallbackContact.address);
    const [phone, setPhone] = useState<string>(fallbackContact.phone);
    const [email, setEmail] = useState<string>(fallbackContact.email);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const ref = doc(db, "content", "global");
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data() as any;

                    if (typeof data.contactAddress === "string" && data.contactAddress.trim()) {
                        setAddress(data.contactAddress.trim());
                    }

                    if (typeof data.contactPhone === "string" && data.contactPhone.trim()) {
                        setPhone(data.contactPhone.trim());
                    }

                    if (typeof data.contactEmail === "string" && data.contactEmail.trim()) {
                        setEmail(data.contactEmail.trim());
                    }
                }
            } catch (err) {
                console.error("Klarte ikkje å hente kontaktinformasjon:", err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [fallbackContact.address, fallbackContact.phone, fallbackContact.email]);

    const effectiveAddress = address || fallbackContact.address;
    const effectivePhone = phone || fallbackContact.phone;
    const effectiveEmail = email || fallbackContact.email;

    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, "");
        if (digits.length === 8) {
            return digits.replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3");
        }
        return value;
    };

    const displayPhone = effectivePhone ? formatPhone(effectivePhone) : "";

    const phoneHref = effectivePhone
        ? `tel:${effectivePhone.replace(/\s+/g, "")}`
        : fallbackContact.phoneHref;

    const emailHref = effectiveEmail
        ? `mailto:${effectiveEmail}`
        : fallbackContact.emailHref;

    if (!effectiveAddress && !effectivePhone && !effectiveEmail && !loading) {
        return null;
    }

    if (variant === "inline") {
        return (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-700">
                {effectiveEmail && (
                    <a
                        href={emailHref}
                        className="hover:underline underline-offset-4"
                    >
                        {effectiveEmail}
                    </a>
                )}

                {effectivePhone && (
                    <>
                        <span aria-hidden="true">·</span>
                        <a
                            href={phoneHref}
                            className="hover:underline underline-offset-4"
                        >
                            {displayPhone}
                        </a>
                    </>
                )}

                {effectiveAddress && (
                    <>
                        <span aria-hidden="true">·</span>
                        <span>{effectiveAddress}</span>
                    </>
                )}
            </div>
        );
    }

    return (
        <p className="mt-4 text-sm leading-7 text-neutral-700">
            <span className="font-medium text-neutral-900">Adresse:</span> {effectiveAddress}
            <br />
            <span className="font-medium text-neutral-900">Telefon:</span>{" "}
            {effectivePhone ? (
                <a href={phoneHref} className="hover:underline underline-offset-4">
                    {displayPhone}
                </a>
            ) : (
                <span>-</span>
            )}
            <br />
            <span className="font-medium text-neutral-900">E-post:</span>{" "}
            {effectiveEmail ? (
                <a href={emailHref} className="hover:underline underline-offset-4">
                    {effectiveEmail}
                </a>
            ) : (
                <span>-</span>
            )}
        </p>
    );
}
