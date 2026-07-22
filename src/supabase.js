// src/supabase.js — подключение «120 app» к Supabase.
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function ensureUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session.user;
    const { data } = await supabase.auth.signInAnonymously();
    return data?.user ?? null;
  } catch { return null; }
}

export const dayKeyOf = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export async function pushEntry(entry) {
  try {
    const user = await ensureUser();
    if (!user) return;
    await supabase.from("entries").upsert(
      {
        user_id: user.id,
        day_key: dayKeyOf(entry.date),
        date: entry.date,
        sys: entry.sys,
        dia: entry.dia,
        sleep: entry.sleep ?? null,
        steps: entry.steps ?? null,
        stress: entry.stress ?? null,
        salt: entry.salt ?? null,
        alcohol: entry.alcohol ?? null,
        taken: entry.taken ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day_key" }
    );
  } catch { /* офлайн */ }
}

export async function pullEntries() {
  try {
    const user = await ensureUser();
    if (!user) return null;
    const { data, error } = await supabase.from("entries").select("*").order("date");
    if (error) return null;
    return data ?? null;
  } catch { return null; }
}

export async function pushAll(entries) {
  for (const e of entries) await pushEntry(e);
}

export async function pushSettings(time, profile) {
  try {
    const user = await ensureUser();
    if (!user) return;
    await supabase.from("settings").upsert({
      user_id: user.id,
      time: time ?? null,
      profile: profile ?? null,
      updated_at: new Date().toISOString(),
    });
  } catch { /* no-op */ }
}
