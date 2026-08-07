"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

type NoticeTone = "success" | "error" | "info";

type Notice = {
    id: number;
    message: string;
    tone: NoticeTone;
};

type ConfirmOptions = {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
};

type ConfirmState = ConfirmOptions & {
    resolve: (confirmed: boolean) => void;
};

type SystemFeedbackValue = {
    notify: (message: string, tone?: NoticeTone) => void;
    confirmAction: (options: ConfirmOptions) => Promise<boolean>;
};

const SystemFeedbackContext = createContext<SystemFeedbackValue | null>(null);

export function SystemFeedbackProvider({ children }: { children: ReactNode }) {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [confirmation, setConfirmation] = useState<ConfirmState | null>(null);
    const nextNoticeId = useRef(0);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    const notify = useCallback((message: string, tone: NoticeTone = "info") => {
        const id = ++nextNoticeId.current;
        setNotices((current) => [...current, { id, message, tone }]);
        window.setTimeout(() => {
            setNotices((current) => current.filter((notice) => notice.id !== id));
        }, tone === "error" ? 7000 : 4500);
    }, []);

    const confirmAction = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setConfirmation({ ...options, resolve });
        });
    }, []);

    const closeConfirmation = useCallback((confirmed: boolean) => {
        setConfirmation((current) => {
            current?.resolve(confirmed);
            return null;
        });
    }, []);

    useEffect(() => {
        if (!confirmation) return;
        confirmButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeConfirmation(false);
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [confirmation, closeConfirmation]);

    return (
        <SystemFeedbackContext.Provider value={{ notify, confirmAction }}>
            {children}

            <div
                className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:w-[380px]"
                aria-live="polite"
                aria-atomic="true"
            >
                {notices.map((notice) => (
                    <div
                        key={notice.id}
                        role={notice.tone === "error" ? "alert" : "status"}
                        className={`pointer-events-auto w-full rounded-[16px] border px-4 py-3 shadow-lg backdrop-blur ${
                            notice.tone === "success"
                                ? "border-emerald-200 bg-emerald-50/95 text-emerald-900"
                                : notice.tone === "error"
                                  ? "border-red-200 bg-red-50/95 text-red-900"
                                  : "border-neutral-200 bg-white/95 text-neutral-900"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-[0.18em] opacity-60">
                                    Valldal Safteri
                                </p>
                                <p className="mt-1 text-sm leading-5">{notice.message}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNotices((current) => current.filter((item) => item.id !== notice.id))}
                                className="rounded-full px-1 text-lg leading-none opacity-50 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
                                aria-label="Lukk melding"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {confirmation ? (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-[2px]"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeConfirmation(false);
                    }}
                >
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="system-confirm-title"
                        aria-describedby="system-confirm-message"
                        className="w-full max-w-md rounded-[24px] border border-neutral-200 bg-[#fdfcf9] p-6 text-neutral-900 shadow-2xl"
                    >
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">
                            Valldal Safteri
                        </p>
                        <h2 id="system-confirm-title" className="mt-3 text-xl font-semibold tracking-tight">
                            {confirmation.title || "Stadfest handling"}
                        </h2>
                        <p id="system-confirm-message" className="mt-3 text-sm leading-6 text-neutral-600">
                            {confirmation.message}
                        </p>
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => closeConfirmation(false)}
                                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700"
                            >
                                {confirmation.cancelLabel || "Avbryt"}
                            </button>
                            <button
                                ref={confirmButtonRef}
                                type="button"
                                onClick={() => closeConfirmation(true)}
                                className={`rounded-full px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                                    confirmation.destructive
                                        ? "bg-red-700 hover:bg-red-800 focus-visible:ring-red-700"
                                        : "bg-neutral-900 hover:bg-neutral-800 focus-visible:ring-neutral-900"
                                }`}
                            >
                                {confirmation.confirmLabel || "Stadfest"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </SystemFeedbackContext.Provider>
    );
}

export function useSystemFeedback() {
    const context = useContext(SystemFeedbackContext);
    if (!context) {
        throw new Error("useSystemFeedback must be used within SystemFeedbackProvider");
    }
    return context;
}
