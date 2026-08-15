"use client";

import { useEffect, useState } from "react";
import {
  createAdminOperator,
  subscribeAdminOperators,
  updateAdminOperator,
  type AdminOperator,
} from "@/lib/adminOperators";

export default function AdminOperatorsPage() {
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeAdminOperators(setOperators, () => setMessage("Klarte ikkje å hente brukarane.")), []);

  async function addOperator() {
    try {
      setSaving(true);
      setMessage("");
      await createAdminOperator(name);
      setName("");
      setMessage("Brukaren er lagt til.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Klarte ikkje å leggje til brukaren.");
    } finally {
      setSaving(false);
    }
  }

  async function saveName(item: AdminOperator) {
    try {
      setSaving(true);
      await updateAdminOperator(item.id, { name: editingName });
      setEditing(null);
      setMessage("Namnet er oppdatert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Klarte ikkje å oppdatere brukaren.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: AdminOperator) {
    try {
      setSaving(true);
      await updateAdminOperator(item.id, { active: !item.active });
      setMessage(item.active ? "Brukaren er teken bort frå veljaren." : "Brukaren er aktiv igjen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Klarte ikkje å oppdatere brukaren.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
      <header className="border-b border-[color:var(--admin-line)] pb-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--admin-muted)]">System</p>
        <h1 className="mt-2 text-3xl tracking-tight md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>Brukarar</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--admin-muted)]">
          Desse namna blir brukte som arbeidsstempel. Dei har ikkje eiga innlogging eller tilgangskontroll.
        </p>
      </header>

      <section className="mt-7 rounded-[22px] border border-[color:var(--admin-line)] bg-white p-5">
        <h2 className="text-base font-semibold">Legg til brukar</h2>
        <div className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row">
          <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addOperator(); }} placeholder="Namn" className="min-w-0 flex-1 rounded-[12px] border border-[color:var(--admin-line-strong)] px-3 py-2.5 text-sm outline-none" />
          <button type="button" disabled={saving || !name.trim()} onClick={() => void addOperator()} className="rounded-full bg-[color:var(--admin-accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">Legg til</button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[22px] border border-[color:var(--admin-line)] bg-white">
        {operators.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 border-b border-[color:var(--admin-line)] px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {editing === item.id ? (
                <input value={editingName} autoFocus onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveName(item); }} className="rounded-[10px] border border-[color:var(--admin-line-strong)] px-3 py-2 text-sm outline-none" />
              ) : (
                <p className={`font-medium ${item.active ? "" : "text-[color:var(--admin-muted)] line-through"}`}>{item.name}</p>
              )}
              <p className="mt-1 text-xs text-[color:var(--admin-muted)]">{item.active ? "Kan veljast" : "Deaktivert – historikken blir bevart"}</p>
            </div>
            <div className="flex gap-2">
              {editing === item.id ? (
                <button type="button" onClick={() => void saveName(item)} className="admin-button-secondary px-4 py-2 text-xs">Lagre namn</button>
              ) : (
                <button type="button" onClick={() => { setEditing(item.id); setEditingName(item.name); }} className="admin-button-secondary px-4 py-2 text-xs">Endre namn</button>
              )}
              <button type="button" disabled={saving} onClick={() => void toggleActive(item)} className="admin-button-secondary px-4 py-2 text-xs">{item.active ? "Deaktiver" : "Aktiver"}</button>
            </div>
          </div>
        ))}
        {!operators.length ? <p className="px-5 py-8 text-sm text-[color:var(--admin-muted)]">Ingen brukarar er oppretta enno.</p> : null}
      </section>
      {message ? <p className="mt-4 text-sm text-[color:var(--admin-muted)]">{message}</p> : null}
    </main>
  );
}
