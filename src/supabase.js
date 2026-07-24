// src/supabase.js — подключение «120 app» к Supabase.
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Возвращает вошедшего пользователя. Анонимных больше НЕ создаём.
export async function ensureUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && !session.user.is_anonymous) return session.user;
    return null;
  } catch { return null; }
}

// Отправляет письмо со ссылкой для входа.
export async function requestMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return error ? error.message : null;
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

// Читает собственную строку настроек (время, профиль, имя).
export async function pullSettings() {
  try {
    const user = await ensureUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("settings")
      .select("time, profile, name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return null;
    return data ?? null;
  } catch { return null; }
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

// Обновляет только заданные поля: пустое не затирает сохранённое.
export async function pushSettings(time, profile, name) {
  try {
    const user = await ensureUser();
    if (!user) return;
    const row = { user_id: user.id, updated_at: new Date().toISOString() };
    if (time != null) row.time = time;
    if (profile != null) row.profile = profile;
    if (name && String(name).trim()) row.name = String(name).trim();
    await supabase.from("settings").upsert(row);
  } catch { /* no-op */ }
}
