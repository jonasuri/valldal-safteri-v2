"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  createAdminOperator,
  getLastOperatorActivity,
  getStoredOperator,
  markOperatorActivity,
  storeOperator,
  subscribeAdminOperators,
  type AdminOperator,
  type OperatorStamp,
} from "@/lib/adminOperators";

const INACTIVITY_MS = 30 * 60 * 1000;

type OperatorContextValue = {
  operator: OperatorStamp | null;
  chooseOperator: (operator: OperatorStamp) => void;
  lockOperator: () => void;
};

const OperatorContext = createContext<OperatorContextValue | null>(null);

export function useAdminOperator() {
  const value = useContext(OperatorContext);
  if (!value) throw new Error("useAdminOperator må brukast i AdminOperatorProvider.");
  return value;
}

export default function AdminOperatorProvider({ children }: { children: ReactNode }) {
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [operator, setOperator] = useState<OperatorStamp | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeAdminOperators((items) => {
    setOperators(items);
    const stored = getStoredOperator();
    const matching = stored && items.find((item) => item.id === stored.id && item.active);
    if (matching) {
      setOperator({ id: matching.id, name: matching.name });
      setLocked(Date.now() - getLastOperatorActivity() >= INACTIVITY_MS);
    } else {
      setOperator(null);
      storeOperator(null);
      setLocked(true);
    }
    setLoaded(true);
  }, () => {
    setError("Klarte ikkje å hente brukarane.");
    setLoaded(true);
  }), []);

  const chooseOperator = useCallback((next: OperatorStamp) => {
    storeOperator(next);
    setOperator(next);
    setLocked(false);
    setError("");
  }, []);

  const lockOperator = useCallback(() => setLocked(true), []);

  useEffect(() => {
    if (!operator || locked) return;
    let lastRecorded = 0;
    const recordActivity = () => {
      const now = Date.now();
      if (now - lastRecorded < 15_000) return;
      lastRecorded = now;
      markOperatorActivity();
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    const interval = window.setInterval(() => {
      if (Date.now() - getLastOperatorActivity() >= INACTIVITY_MS) setLocked(true);
    }, 30_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      window.clearInterval(interval);
    };
  }, [operator, locked]);

  async function addFirstOperator() {
    try {
      setCreating(true);
      setError("");
      const created = await createAdminOperator(newName);
      chooseOperator({ id: created.id, name: newName.trim() });
      setNewName("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Klarte ikkje å opprette brukaren.");
    } finally {
      setCreating(false);
    }
  }

  const activeOperators = operators.filter((item) => item.active);
  const value = useMemo(() => ({ operator, chooseOperator, lockOperator }), [operator, chooseOperator, lockOperator]);
  const showSelector = loaded && (locked || !operator);

  return (
    <OperatorContext.Provider value={value}>
      {children}

      {operator && !showSelector ? (
        <button
          type="button"
          onClick={lockOperator}
          className="print:hidden fixed bottom-5 right-5 z-50 rounded-full border border-[color:var(--admin-line-strong)] bg-white px-4 py-2 text-xs font-medium text-[color:var(--admin-ink)] shadow-md transition hover:bg-[color:var(--admin-active)]"
          title="Byt aktiv brukar"
        >
          Arbeider som {operator.name}
        </button>
      ) : null}

      {showSelector ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--admin-canvas)]/95 px-4 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-[26px] border border-[color:var(--admin-line)] bg-white p-7 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">Valldal Safteri</p>
            <h1 className="mt-2 text-3xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
              Kven arbeider no?
            </h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--admin-muted)]">
              Valet blir brukt som eit enkelt stempel på arbeid som blir utført.
            </p>

            {activeOperators.length ? (
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {activeOperators.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseOperator({ id: item.id, name: item.name })}
                    className="rounded-[16px] border border-[color:var(--admin-line-strong)] bg-white px-4 py-4 text-left text-base font-medium transition hover:border-[color:var(--admin-accent)] hover:bg-[color:var(--admin-active)]"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[18px] border border-[color:var(--admin-line)] bg-[color:var(--admin-canvas)] p-4">
                <p className="text-sm font-medium">Opprett den første brukaren</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") void addFirstOperator(); }}
                    placeholder="Namn"
                    className="min-w-0 flex-1 rounded-[12px] border border-[color:var(--admin-line-strong)] px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    disabled={creating || !newName.trim()}
                    onClick={() => void addFirstOperator()}
                    className="rounded-full bg-[color:var(--admin-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {creating ? "Lagrar …" : "Opprett"}
                  </button>
                </div>
              </div>
            )}

            {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
            {activeOperators.length ? (
              <Link href="/admin/operators" className="mt-6 inline-flex text-xs font-medium text-[color:var(--admin-muted)] underline underline-offset-4">
                Legg til eller endre brukarar
              </Link>
            ) : null}
          </section>
        </div>
      ) : null}
    </OperatorContext.Provider>
  );
}
