import React, { useState, useMemo, useEffect } from "react";
import {
  Moon, Footprints, Brain, Utensils, Pill, Heart, ChevronRight,
  Check, Sparkles, TrendingDown, Info, Plus, Minus, Lightbulb,
  Clock, Bell, Sun, Wine
} from "lucide-react";
import { supabase, pushEntry, pullEntries, pullSettings, pushAll, pushSettings, requestMagicLink, dayKeyOf } from "./supabase";

// ---- Design tokens -----------------------------------------------------
const C = {
  bg: "#0E2A2E", panel: "#123437", panelSoft: "#16413F",
  mint: "#A8E6D0", mintDim: "#6FBFA5", cream: "#F3F0E9", creamDim: "#B9C6C2",
  coral: "#F5A38B", line: "#20514F", good: "#8FD4B0", warn: "#F0C27B",
};

// ---- Persistence (local-first) ------------------------------------------
// Использует localStorage, когда он доступен (реальное приложение на телефоне),
// и память как запасной вариант (предпросмотр, где localStorage недоступен).
// В предпросмотре данные не переживают перезагрузку; на телефоне — переживают.
const memStore = {};
function storeGet(key) {
  try { return localStorage.getItem(key); } catch { return memStore[key] ?? null; }
}
function storeSet(key, val) {
  try { localStorage.setItem(key, val); } catch { memStore[key] = val; }
}

const STORE_KEY = "davlenie_entries_v1";

// Демо-режим: генерирует 27 дней примерных данных, чтобы показать графики.
// Сейчас выключен — приложение готово к реальному использованию.
const DEMO_MODE = false;
function loadEntries() {
  try {
    const raw = storeGet(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function persist(entries) {
  try { storeSet(STORE_KEY, JSON.stringify(entries)); } catch { /* no-op */ }
}

const SETTINGS_KEY = "davlenie_settings_v1";
const FACT_SHOWN_KEY = "davlenie_fact_shown_v1";
const NAME_KEY = "davlenie_name_v1"; // имя для семейной сводки; переживает редирект входа
const OWNER_KEY = "davlenie_owner_v1"; // чей аккаунт владеет локальным кэшем
function loadSettings() {
  try {
    const raw = storeGet(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function persistSettings(s) {
  try { storeSet(SETTINGS_KEY, s == null ? "" : JSON.stringify(s)); } catch { /* no-op */ }
}

// ---- Interesting facts about hypertension (rotate) ---------------------
const FACTS = [
  "Давление обычно немного выше утром и ниже во время сна — поэтому важно измерять его в одно и то же время.",
  "Стакан воды и 5 минут покоя перед измерением делают результат точнее.",
  "Соль задерживает воду в организме, и это напрямую повышает давление. Даже небольшое сокращение соли помогает.",
  "Регулярная ходьба — одно из самых доказанных немедикаментозных средств снижения давления.",
  "Недосып всего в пару часов может заметно поднять давление на следующий день.",
  "Кофе может временно поднять давление — измеряйте не раньше чем через 30 минут после чашки.",
  "Приём лекарств в одно и то же время каждый день делает лечение заметно эффективнее.",
  "Давление меняется в течение дня — одно высокое измерение ещё не диагноз. Важна общая картина.",
  "Во время измерения спина должна опираться на спинку стула, а рука — лежать на столе на уровне сердца.",
  "Манжета на запястье менее точна, чем на плече. Если есть выбор — измеряйте на плече.",
  "Разговор во время измерения может прибавить несколько единиц. Лучше минуту помолчать.",
  "Полный мочевой пузырь может заметно повысить показания — лучше измерять после туалета.",
  "Большая часть соли приходит не из солонки, а из хлеба, сыра, колбасы и готовой еды.",
  "Калий помогает выводить лишний натрий. Его много в бананах, картофеле, кураге и фасоли.",
  "Даже 10–15 минут ходьбы после еды — вклад в ваше давление. Необязательно сразу 10 000 шагов.",
  "Алкоголь повышает давление на следующий день — даже небольшие дозы влияют на утренние показания.",
  "Курение поднимает давление на 15–30 минут после каждой сигареты и ускоряет износ сосудов.",
  "Лишний вес — нагрузка на сосуды. Снижение даже на несколько килограммов часто отражается на давлении.",
  "Глубокое медленное дыхание в течение пары минут может немного снизить давление здесь и сейчас.",
  "Холодная погода слегка повышает давление — зимой показания часто чуть выше, это нормально.",
  "Первое измерение часто выше последующих. Врачи советуют сделать два и записать среднее.",
  "«Гипертония белого халата» — у многих давление у врача выше, чем дома. Домашний дневник помогает это увидеть.",
  "Пропуск лекарства на один день может отражаться на давлении ещё несколько дней.",
  "Регулярный сон в одно и то же время помогает давлению не меньше, чем его длительность.",
];

const FACTORS = [
  { key: "sleep", label: "Сон", labelMorning: "Сон этой ночью", icon: Moon, unit: "ч", suffix: "ч", min: 3, max: 11, step: 0.5, def: 7, type: "stepper",
    hint: "Количество часов, которое вы спали" },
  { key: "steps", label: "Шаги", labelMorning: "Шаги вчера", icon: Footprints, unit: "", min: 0, max: 20000, step: 500, def: 3000, type: "steps" },
  { key: "stress", label: "Стресс", labelMorning: "Стресс вчера", icon: Brain, unit: "из 5", min: 1, max: 5, step: 1, def: 3, type: "scale",
    hint: "1 — спокойный день · 5 — очень тяжёлый" },
  { key: "salt", label: "Солёная еда", labelMorning: "Солёная еда вчера", icon: Utensils, unit: "из 5", min: 1, max: 5, step: 1, def: 2, type: "scale",
    hint: "1 — почти без соли · 5 — колбаса, сыр, соленья" },
];

// Алкоголь — необязательный фактор: появляется только если в профиле
// человек ответил «да» на вопрос об алкоголе. Шкала грубая — так честнее отвечают.
const ALCOHOL_FACTOR = {
  key: "alcohol", label: "Алкоголь", labelMorning: "Алкоголь вчера", icon: Wine,
  type: "choice", def: 0,
  options: [{ v: 0, l: "нет" }, { v: 1, l: "немного" }, { v: 2, l: "прилично" }],
};
const ALL_FACTORS = [...FACTORS, ALCOHOL_FACTOR];

function makeHistory() {
  const rows = [];
  const base = new Date();
  for (let i = 27; i >= 1; i--) {
    const d = new Date(base); d.setDate(base.getDate() - i);
    const sleep = 5 + Math.round(Math.random() * 8) / 2;
    const stress = 1 + Math.floor(Math.random() * 5);
    const salt = 1 + Math.floor(Math.random() * 5);
    const steps = Math.floor(Math.random() * 9000) + 1000;
    const sys = Math.round(120 + (stress - 3) * 5 + (3 - sleep + 4) * 1.6 + (salt - 2) * 3 - steps * 0.0006 + (Math.random() * 6 - 3));
    const dia = Math.round(sys * 0.63 + (Math.random() * 4 - 2));
    rows.push({ date: d.toISOString(), sleep, stress, salt, steps, sys, dia, taken: Math.random() > 0.15 });
  }
  return rows;
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy || 1);
}

const fmtNum = (n) => n.toLocaleString("ru-RU");

// Склонение: 1 день, 2 дня, 5 дней, 11 дней…
const pluralDays = (n) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "дня";
  return "дней";
};
const pluralZapisey = (n) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "запись";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "записи";
  return "записей";
};

// Дни недели в винительном падеже, с правильным предлогом.
const WEEKDAYS_ACC = ["в воскресенье", "в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу"];

// Микро-наблюдения до первой закономерности: только факты из данных,
// никаких выводов и никаких «закономерностей» раньше времени.
function microObservations(history) {
  const obs = [];
  if (history.length >= 3) {
    const lowest = history.reduce((a, b) => (b.sys < a.sys ? b : a));
    obs.push({
      icon: "low",
      text: `Самое низкое давление было ${WEEKDAYS_ACC[new Date(lowest.date).getDay()]} — ${lowest.sys}/${lowest.dia}`,
    });
  }
  if (history.length >= 5) {
    const last7 = history.slice(-7);
    const avgS = Math.round(last7.reduce((s, r) => s + r.sys, 0) / last7.length);
    const avgD = Math.round(last7.reduce((s, r) => s + r.dia, 0) / last7.length);
    obs.push({ icon: "avg", text: `Среднее по последним ${last7.length} записям — ${avgS}/${avgD}` });
  }
  if (history.length >= 3) {
    const taken = history.filter((r) => r.taken).length;
    obs.push({ icon: "med", text: `Лекарство отмечено принятым ${taken} из ${history.length} ${pluralDays(history.length)}` });
  }
  return obs.slice(0, 3);
}

export default function App() {
  const [tab, setTab] = useState("log");
  // Загружаем записи один раз; если сегодня уже есть запись —
  // форма стартует с её значениями, а не с «128/82 по умолчанию».
  const initialRef = React.useRef(null);
  if (initialRef.current === null) {
    const entries = loadEntries() || (DEMO_MODE ? makeHistory() : []);
    const t = new Date().toDateString();
    initialRef.current = {
      entries,
      today: entries.find((r) => new Date(r.date).toDateString() === t) || null,
    };
  }
  const { entries: initialEntries, today: todayEntry } = initialRef.current;

  const [history, setHistory] = useState(initialEntries);
  const [sys, setSys] = useState(todayEntry ? todayEntry.sys : 128);
  const [dia, setDia] = useState(todayEntry ? todayEntry.dia : 82);
  const [factors, setFactors] = useState(() =>
    Object.fromEntries(ALL_FACTORS.map((f) => [f.key, todayEntry && todayEntry[f.key] != null ? todayEntry[f.key] : f.def]))
  );
  const [medTaken, setMedTaken] = useState(todayEntry ? !!todayEntry.taken : true);
  const [saved, setSaved] = useState(false);
  const [askUpdate, setAskUpdate] = useState(false);
  const [showProfileFlow, setShowProfileFlow] = useState(false);
  const [profilePromptHidden, setProfilePromptHidden] = useState(false);
  const [editDay, setEditDay] = useState(null); // { dateISO, entry|null }
  const [settings, setSettings] = useState(() => loadSettings());

  // Факторы, которые реально показываем: алкоголь — только для тех, кто пьёт.
  const activeFactors = useMemo(
    () => (settings?.profile?.alcohol === "yes" ? ALL_FACTORS : FACTORS),
    [settings]
  );

  useEffect(() => { persist(history); }, [history]);
  useEffect(() => { if (settings) persistSettings(settings); }, [settings]);

  // «Сердцебиение» текущего дня: Android может держать приложение в памяти
  // сутками, и без этого всё, что зависит от «сегодня», застывает во вчера.
  const [todayStr, setTodayStr] = useState(() => new Date().toDateString());
  useEffect(() => {
    const upd = () => setTodayStr(new Date().toDateString());
    const iv = setInterval(upd, 60000);
    document.addEventListener("visibilitychange", upd);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", upd); };
  }, []);

  // Аккаунт: следим за сессией. Анонимные сессии со старой версии считаем
  // «не вошёл» — человек один раз входит по ссылке из письма и получает
  // постоянный аккаунт, общий для всех его устройств.
  const [authChecked, setAuthChecked] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const authedId = authUser && !authUser.is_anonymous ? authUser.id : null;

  // Имя для шапки и семейной сводки + открыта ли карточка аккаунта.
  const [userName, setUserName] = useState(() => storeGet(NAME_KEY) || "");
  const [accountOpen, setAccountOpen] = useState(false);

  // Синхронизация: запускается, когда человек вошёл. Сервер — источник истины
  // по дням, но дни, которых на сервере нет (офлайн), доталкиваем наверх.
  // Здесь же — отправка настроек и имени (у старых устройств они были только локально).
  useEffect(() => {
    if (!authedId) return;
    (async () => {
      // Локальный кэш принадлежит конкретному аккаунту. Если на этом устройстве
      // раньше был другой человек — его записи, имя и настройки НЕ считаем
      // своими: не выгружаем и убираем.
      const owner = storeGet(OWNER_KEY);
      const foreign = owner && owner !== authedId;
      if (foreign) {
        persist([]);
        setHistory([]);
        initialRef.current.entries = [];
        initialRef.current.today = null;
        storeSet(NAME_KEY, "");
        setUserName("");
        persistSettings(null);
        setSettings(null);
      }
      storeSet(OWNER_KEY, authedId);

      // Один запрос настроек с сервера: возвращающемуся пользователю
      // восстанавливаем время и профиль (обещание «вернутся при входе»),
      // и подтягиваем имя, если локально его нет.
      const rs = await pullSettings();
      let s = foreign ? null : loadSettings();
      if (!s && rs && (rs.time || rs.profile)) {
        s = { time: rs.time || "08:00", reminderOn: true, profile: rs.profile ?? null };
        persistSettings(s);
        setSettings(s);
      }
      if (!storeGet(NAME_KEY) && rs?.name) {
        storeSet(NAME_KEY, rs.name);
        setUserName(rs.name);
      }
      // Настройки и имя — на сервер (patch: пустое ничего не затирает).
      pushSettings(s?.time, s?.profile, storeGet(NAME_KEY));
      const remote = await pullEntries();
      if (remote === null) return; // офлайн — живём локально
      const local = initialRef.current.entries;
      if (remote.length === 0) {
        if (local.length > 0) pushAll(local); // первая миграция локальной истории
        return;
      }
      const remoteMap = new Map(remote.map((r) => [r.day_key, r]));
      const localOnly = local.filter((e) => !remoteMap.has(dayKeyOf(e.date)));
      if (localOnly.length > 0) pushAll(localOnly);
      const merged = [
        ...remote.map((r) => ({
          date: r.date, sys: r.sys, dia: r.dia,
          sleep: r.sleep != null ? Number(r.sleep) : null,
          steps: r.steps, stress: r.stress, salt: r.salt,
          alcohol: r.alcohol, taken: r.taken,
        })),
        ...localOnly,
      ].sort((a, b) => new Date(a.date) - new Date(b.date));
      setHistory(merged);
    })();
  }, [authedId]);

  // Факт дня при запуске: показываем один раз в день, при первом открытии.
  const [factSplash, setFactSplash] = useState(null);
  useEffect(() => {
    if (!settings) return; // не поверх экрана настройки
    if (storeGet(FACT_SHOWN_KEY) === todayStr) return;
    const dayIdx = Math.floor(Date.now() / 86400000) % FACTS.length; // ротация по дате
    setFactSplash(FACTS[dayIdx]);
    // Важно: НЕ помечаем показанным здесь. Если страницу перезагрузит
    // обновление PWA, факт покажется снова — иначе он «сгорает» непрочитанным.
  }, [settings, todayStr]);

  const dismissFact = () => {
    storeSet(FACT_SHOWN_KEY, new Date().toDateString()); // прочитан — больше не показываем сегодня
    setFactSplash(null);
  };

  // Has today's entry already been logged? Считаем только по данным,
  // а не по флагу saved — иначе наутро приложение показывало бы
  // «сохранено», хотя новой записи ещё нет.
  const loggedToday = useMemo(() => {
    return history.some((r) => new Date(r.date).toDateString() === todayStr);
  }, [history, todayStr]);

  // Classified by the HIGHER of the two values (ESH-style grading).
  const bpBand = useMemo(() => {
    if (sys >= 180 || dia >= 110) return { label: "Очень высокое — к врачу", color: "#EC7A6A" };
    if (sys >= 160 || dia >= 100) return { label: "2 степень", color: "#EC7A6A" };
    if (sys >= 140 || dia >= 90) return { label: "1 степень", color: C.coral };
    if (sys >= 130 || dia >= 85) return { label: "Повышенное", color: C.warn };
    return { label: "Норма", color: C.good };
  }, [sys, dia]);

  const insight = useMemo(() => {
    // Кандидаты считаются каждый по своему подмножеству записей, где фактор
    // заполнен (алкоголь есть не во всех записях). Меньше 5 пар — не участвует.
    // Также фактор должен реально меняться: если все значения по одну сторону
    // от середины (например, почти всегда «нет алкоголя»), сравнивать не с чем.
    const defs = [
      { key: "sleep", label: "сна", expected: -1 },
      { key: "steps", label: "шагов", expected: -1 },
      { key: "stress", label: "стресса", expected: 1 },
      { key: "salt", label: "солёной еды", expected: 1 },
      { key: "alcohol", label: "алкоголя", expected: 1 },
    ];
    const cands = defs.map((c) => {
      const rows = history.filter((r) => r[c.key] != null);
      if (rows.length < 5) return { ...c, r: 0, usable: false };
      const vals = rows.map((r) => r[c.key]);
      const mid = (Math.min(...vals) + Math.max(...vals)) / 2;
      const hasHi = vals.some((v) => v >= mid && v !== Math.min(...vals));
      const hasLo = vals.some((v) => v < mid);
      if (!hasHi || !hasLo) return { ...c, r: 0, usable: false }; // нет двух групп для сравнения
      return { ...c, r: pearson(vals, rows.map((r) => r.sys)), usable: true };
    });
    const usable = cands.filter((c) => c.usable);
    if (usable.length === 0) return null; // пока не с чем работать
    usable.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return usable[0];
  }, [history]);

  const daysLogged = history.length;

  // Мягкая серия: сколько записей за последние 14 календарных дней
  // (окно короче, если дневник ведётся меньше двух недель).
  // Никогда не «сгорает» — пропуск просто уменьшает счёт на единицу.
  const streak = useMemo(() => {
    if (history.length === 0) return null;
    const now = Date.now();
    const first = new Date(history[0].date).getTime();
    const windowDays = Math.min(14, Math.floor((now - first) / 86400000) + 1);
    const count = history.filter((r) => now - new Date(r.date).getTime() < windowDays * 86400000).length;
    return { count: Math.min(count, windowDays), windowDays };
  }, [history, todayStr]);

  // Карточка подтверждения не должна переживать смену вкладки или дня.
  useEffect(() => { setAskUpdate(false); }, [tab, todayStr]);

  // До 14 дней прогресс ведёт к первой закономерности, после — к полной картине.
  const INSIGHT_GATE = 14;
  const toInsight = daysLogged < INSIGHT_GATE;
  const daysLeft = INSIGHT_GATE - daysLogged;
  const progress = toInsight
    ? Math.round((daysLogged / INSIGHT_GATE) * 100)
    : Math.min(100, Math.round((daysLogged / 60) * 100));
  const fact = FACTS[daysLogged % FACTS.length];

  const saveEntry = () => {
    const nowStr = new Date().toDateString();
    const entry = {
      date: new Date().toISOString(), sys, dia, taken: medTaken,
      ...Object.fromEntries(activeFactors.map((f) => [f.key, factors[f.key]])),
    };
    // Одна запись в день: повторное сохранение обновляет сегодняшнюю.
    setHistory((h) => [...h.filter((r) => new Date(r.date).toDateString() !== nowStr), entry]);
    pushEntry(entry); // в облако, не блокируя сохранение
    setSaved(true);
    setTimeout(() => setTab("insight"), 600);
    setTimeout(() => setSaved(false), 2000); // «Сохранено» — короткое подтверждение, не постоянное состояние
  };

  // Пока не знаем состояние сессии — ничего не мигаем на экране.
  if (!authChecked) {
    return <div style={{ minHeight: "100vh", background: C.bg }} />;
  }
  // Нет постоянного аккаунта → один раз входим по ссылке из письма.
  if (!authedId) {
    return <SignIn />;
  }
  // First run: pick the daily reading time before anything else.
  if (!settings) {
    return <Setup mode="full" onDone={({ time, profile }) => { setSettings({ time, reminderOn: true, profile }); pushSettings(time, profile, storeGet(NAME_KEY)); }} />;
  }
  // Существующий пользователь заполняет профиль отдельным мягким шагом.
  if (showProfileFlow) {
    return <Setup mode="profile"
      onDone={(profile) => { setSettings((s) => ({ ...s, profile })); pushSettings(settings.time, profile, storeGet(NAME_KEY)); setShowProfileFlow(false); }}
      onCancel={() => { setShowProfileFlow(false); setProfilePromptHidden(true); }} />;
  }

  // Утреннее измерение → вопросы про вчерашний день и прошедшую ночь.
  const morning = parseInt(settings.time.split(":")[0], 10) < 12;

  // Редактирование прошлого дня или добавление пропущенного (последние 7 дней).
  if (editDay) {
    return <EditDay
      day={editDay}
      activeFactors={activeFactors}
      onCancel={() => setEditDay(null)}
      onSave={(entry) => {
        const ds = new Date(entry.date).toDateString();
        setHistory((h) => {
          const next = [...h.filter((r) => new Date(r.date).toDateString() !== ds), entry];
          next.sort((a, b) => new Date(a.date) - new Date(b.date)); // порядок важен для графика и серии
          return next;
        });
        pushEntry(entry); // в облако тем же путём, что и обычное сохранение
        // Если правили сегодняшний день — обновляем и форму на «Сегодня».
        if (ds === todayStr) {
          setSys(entry.sys); setDia(entry.dia); setMedTaken(!!entry.taken);
          setFactors((s) => ({ ...s, ...Object.fromEntries(activeFactors.map((f) => [f.key, entry[f.key] != null ? entry[f.key] : s[f.key]])) }));
        }
        setEditDay(null);
      }}
    />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .phone::-webkit-scrollbar{ display:none; }
        @media (prefers-reduced-motion: reduce){ *{ transition:none !important; } }
        button:focus-visible{ outline:3px solid ${C.mint}; outline-offset:2px; }
      `}</style>

      {factSplash && <FactSplash text={factSplash} onClose={dismissFact} />}
      {accountOpen && (
        <AccountCard
          name={userName}
          email={authUser?.email || ""}
          time={settings.time}
          onRename={(v) => {
            const clean = v.trim();
            if (!clean) return;
            storeSet(NAME_KEY, clean);
            setUserName(clean);
            pushSettings(null, null, clean); // patch: обновит только имя
          }}
          onSignOut={async () => {
            setAccountOpen(false);
            try { await supabase.auth.signOut(); } catch { /* сеть */ }
            // Убираем локальные следы: в облаке всё сохранено и вернётся при входе.
            // Иначе следующий вошедший на этом телефоне «унаследует» чужой дневник.
            persist([]);
            storeSet(NAME_KEY, "");
            storeSet(OWNER_KEY, "");
            persistSettings(null);
            setHistory([]);
            setUserName("");
            setSettings(null);
            initialRef.current.entries = [];
            initialRef.current.today = null;
          }}
          onClose={() => setAccountOpen(false)}
        />
      )}

      <div className="phone" style={{
        width: 402, minHeight: "100vh", background: C.bg, position: "relative",
        overflowY: "auto", borderLeft: `1px solid ${C.line}`, borderRight: `1px solid ${C.line}`, paddingBottom: 40,
      }}>
        {/* Header */}
        <div style={{ padding: "26px 24px 6px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Heart size={20} color={C.mint} fill={C.mint} />
              <span style={{ color: C.cream, fontWeight: 700, fontSize: 17 }}>120 app</span>
            </div>
            <button
              onClick={() => setAccountOpen(true)}
              aria-label={`Ваш аккаунт: ${userName || "без имени"}`}
              style={{
                width: 38, height: 38, borderRadius: 99, background: `${C.mint}1E`,
                border: `1.5px solid ${C.mintDim}66`, color: C.mint, fontSize: 16, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {(userName.trim()[0] || "•").toUpperCase()}
            </button>
          </div>
          <p style={{ color: C.creamDim, fontSize: 13.5, margin: "5px 0 0", paddingLeft: 29 }}>
            {daysLogged === 0
              ? "Начните с первой записи"
              : `${daysLogged} ${pluralDays(daysLogged)} наблюдений`}
          </p>
          {streak && streak.windowDays >= 4 && streak.count > 0 && (
            <p style={{ color: streak.count === streak.windowDays ? C.mint : C.creamDim, fontSize: 12, margin: "3px 0 0", paddingLeft: 29 }}>
              {streak.count === streak.windowDays
                ? `Все ${streak.windowDays} ${pluralDays(streak.windowDays)} без пропусков — так держать`
                : `${streak.count} ${pluralZapisey(streak.count)} за последние ${streak.windowDays} ${pluralDays(streak.windowDays)}`}
            </p>
          )}
        </div>

        {/* Progress */}
        <div style={{ padding: "10px 24px 4px" }}>
          <div style={{ height: 6, background: C.line, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: `linear-gradient(90deg, ${C.mintDim}, ${C.mint})`, borderRadius: 99, transition: "width .5s" }} />
          </div>
          <p style={{ color: C.mintDim, fontSize: 12, margin: "7px 2px 0" }}>
            {toInsight
              ? `До первой закономерности — ${daysLeft} ${pluralDays(daysLeft)}`
              : `${progress}% пути к полной картине за 3 месяца`}
          </p>
        </div>

        {/* Tabs — 3 only, big targets */}
        <div style={{ display: "flex", gap: 6, padding: "16px 18px 6px" }}>
          {[{ k: "log", label: "Сегодня" }, { k: "trend", label: "Измерения" }, { k: "insight", label: "Что это значит" }].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: "12px 6px", borderRadius: 13, border: "none", cursor: "pointer",
              fontSize: 13.5, fontWeight: 600, fontFamily: "inherit",
              background: tab === t.k ? C.mint : "transparent", color: tab === t.k ? C.bg : C.creamDim, transition: "all .2s",
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "log" && (
          <div style={{ padding: "10px 18px 0" }}>
            {/* Daily reminder / usual-time strip */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: loggedToday ? "transparent" : `${C.mint}14`,
              border: `1px solid ${loggedToday ? C.line : C.mintDim + "55"}`,
              borderRadius: 14, padding: "12px 15px", marginBottom: 12,
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {loggedToday
                  ? <Check size={17} color={C.mintDim} strokeWidth={2.5} />
                  : <Bell size={17} color={C.mint} />}
                <span style={{ color: C.cream, fontSize: 13, lineHeight: 1.4 }}>
                  {loggedToday
                    ? "Запись за сегодня сохранена"
                    : `Пора измерить давление`}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: C.creamDim, fontSize: 13, fontWeight: 600 }}>
                <Clock size={14} /> {settings.time}
              </span>
            </div>

            <div style={{ background: C.panel, borderRadius: 20, padding: "22px 20px", border: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ color: C.creamDim, fontSize: 14, fontWeight: 500 }}>Артериальное давление</span>
                <span style={{ color: bpBand.color, fontSize: 13, fontWeight: 600, background: `${bpBand.color}22`, padding: "4px 11px", borderRadius: 99 }}>{bpBand.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, margin: "12px 0 2px" }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 64, color: C.coral, lineHeight: 0.9, fontWeight: 500 }}>{sys}</span>
                <span style={{ color: C.creamDim, fontSize: 28, marginBottom: 9 }}>/</span>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 42, color: C.cream, lineHeight: 0.9, marginBottom: 5 }}>{dia}</span>
                <span style={{ color: C.creamDim, fontSize: 13, marginBottom: 11, marginLeft: 3 }}>мм рт.ст.</span>
              </div>
              <div style={{ marginTop: 18 }}>
                <BigStepper label="Верхнее (систолическое)" value={sys} setValue={setSys} min={80} max={200} step={1} />
                <BigStepper label="Нижнее (диастолическое)" value={dia} setValue={setDia} min={40} max={130} step={1} />
              </div>
            </div>

            <button onClick={() => setMedTaken((m) => !m)} style={{
              width: "100%", marginTop: 12, background: C.panel, border: `1px solid ${medTaken ? C.mintDim : C.line}`,
              borderRadius: 16, padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Pill size={19} color={medTaken ? C.mint : C.creamDim} />
                <span style={{ color: C.cream, fontSize: 15, fontWeight: 500 }}>{morning ? "Принял(а) вчерашнее лекарство" : "Принял(а) лекарство"}</span>
              </span>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: medTaken ? C.mint : "transparent", border: `1px solid ${medTaken ? C.mint : C.creamDim}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {medTaken && <Check size={18} color={C.bg} strokeWidth={3} />}
              </span>
            </button>

            <p style={{ color: C.creamDim, fontSize: 12.5, margin: "22px 4px 11px", textTransform: "uppercase", letterSpacing: 0.6 }}>{morning ? "Как прошёл вчерашний день" : "Как прошёл день"}</p>
            <div style={{ display: "grid", gap: 10 }}>
              {activeFactors.map((f) => (
                <FactorRow
                  key={f.key}
                  f={f}
                  morning={morning}
                  value={factors[f.key]}
                  // Поддерживаем и значение, и функцию-обновление (нужно для удержания кнопки).
                  setValue={(next) => setFactors((s) => ({
                    ...s,
                    [f.key]: typeof next === "function" ? next(s[f.key]) : next,
                  }))}
                />
              ))}
            </div>

            {!settings.profile && !profilePromptHidden && (
              <div style={{ marginTop: 14, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "14px 16px" }}>
                <p style={{ color: C.cream, fontSize: 13.5, fontWeight: 600, margin: "0 0 4px" }}>Расскажите немного о себе</p>
                <p style={{ color: C.creamDim, fontSize: 12, margin: "0 0 12px", lineHeight: 1.5 }}>
                  Возраст, рост и пара привычек сделают вашу картину точнее. Все поля можно пропустить.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowProfileFlow(true)} style={{ flex: 1, background: C.mint, color: C.bg, border: "none", borderRadius: 11, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Заполнить</button>
                  <button onClick={() => setProfilePromptHidden(true)} style={{ flex: 1, background: "transparent", color: C.creamDim, border: `1px solid ${C.line}`, borderRadius: 11, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Позже</button>
                </div>
              </div>
            )}

            {askUpdate ? (
              <div style={{ marginTop: 18, background: C.panel, border: `1px solid ${C.warn}66`, borderRadius: 16, padding: "16px" }}>
                <p style={{ color: C.cream, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Запись за сегодня уже есть</p>
                <p style={{ color: C.creamDim, fontSize: 12.5, margin: "0 0 14px", lineHeight: 1.5 }}>
                  Заменить её текущими значениями — {sys}/{dia}?
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setAskUpdate(false); saveEntry(); }} style={{
                    flex: 1, background: C.mint, color: C.bg, border: "none", borderRadius: 12,
                    padding: "14px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>Да, обновить</button>
                  <button onClick={() => setAskUpdate(false)} style={{
                    flex: 1, background: "transparent", color: C.creamDim, border: `1px solid ${C.line}`, borderRadius: 12,
                    padding: "14px", fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>Отмена</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { if (loggedToday && !saved) { setAskUpdate(true); } else { saveEntry(); } }} style={{
                width: "100%", marginTop: 18, background: C.mint, color: C.bg, border: "none", borderRadius: 16,
                padding: "18px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {saved ? <><Check size={20} strokeWidth={3} /> Сохранено</> : loggedToday ? "Обновить запись" : "Сохранить запись"}
              </button>
            )}
            <p style={{ color: C.creamDim, fontSize: 11.5, textAlign: "center", margin: "13px 8px 8px", lineHeight: 1.5 }}>
              Приложение помогает замечать ваши собственные закономерности. Оно не заменяет врача — обсуждайте измерения с лечащим врачом.
            </p>
          </div>
        )}

        {tab === "trend" && <TrendView history={history} fact={fact} onPick={(dateISO, entry) => setEditDay({ dateISO, entry })} />}
        {tab === "insight" && <InsightView history={history} insight={insight} daysLogged={daysLogged} />}
      </div>
    </div>
  );
}

// Факт дня при запуске: плавно появляется, исчезает сам через ~2.5 секунды,
// нажатие в любом месте закрывает сразу. Никогда не блокирует пользователя.
function FactSplash({ text, onClose }) {
  const [leaving, setLeaving] = useState(false);
  const closingRef = React.useRef(false);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setLeaving(true);
    setTimeout(onClose, 350); // даём фейду закончиться
  };

  useEffect(() => {
    // Время показа зависит от длины текста: спокойный темп чтения
    // (~70 мс на символ) плюс секунда на «включиться». Нажатие закрывает раньше.
    const duration = Math.min(9000, Math.max(4500, 1200 + text.length * 70));
    const t = setTimeout(close, duration);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={close}
      role="button"
      aria-label="Факт дня. Нажмите, чтобы продолжить"
      style={{
        position: "fixed", inset: 0, zIndex: 50, background: C.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: leaving ? 0 : 1, transition: "opacity .35s ease",
        cursor: "pointer", animation: "factIn .45s ease",
      }}
    >
      <style>{`@keyframes factIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div style={{ maxWidth: 340, padding: "0 28px", textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 18, background: `${C.mint}1E`,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px",
        }}>
          <Lightbulb size={26} color={C.mint} />
        </div>
        <p style={{ color: C.mint, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 10px" }}>
          Полезно знать
        </p>
        <p style={{ fontFamily: "'Fraunces', serif", color: C.cream, fontSize: 20, fontWeight: 500, lineHeight: 1.45, margin: 0 }}>
          {text}
        </p>
        <p style={{ color: C.creamDim, fontSize: 11, margin: "26px 0 0", opacity: 0.7 }}>
          Нажмите, чтобы продолжить
        </p>
      </div>
    </div>
  );
}

// Настройка: mode="full" — время + профиль (первый запуск),
// mode="profile" — только профиль (для тех, кто уже пользуется).
// Каждый вопрос профиля можно пропустить.
// Настройка: mode="full" — время + профиль (первый запуск),
// mode="profile" — только профиль (для тех, кто уже пользуется).
// Каждый вопрос профиля можно пропустить.
// Вспомогательные компоненты вынесены на уровень модуля: определённые внутри,
// они пересоздавались бы при каждом рендере, и поля ввода теряли бы фокус.
// Карточка аккаунта: кто вошёл, почта, время напоминания, смена имени, выход.
// Открывается по кружку с инициалом в шапке.
function AccountCard({ name, email, time, onRename, onSignOut, onClose }) {
  const [editName, setEditName] = useState(name);
  const [confirmOut, setConfirmOut] = useState(false);
  const changed = editName.trim() !== name && editName.trim().length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60, background: "rgba(10, 26, 29, 0.82)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 350, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 22, padding: "22px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 99, background: `${C.mint}1E`, border: `1.5px solid ${C.mintDim}66`, color: C.mint, fontSize: 21, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {(name.trim()[0] || "•").toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: C.cream, fontSize: 15.5, fontWeight: 700, margin: 0 }}>
              {name.trim() ? `Вы вошли как: ${name}` : "Вы вошли в аккаунт"}
            </p>
            <p style={{ color: C.creamDim, fontSize: 12.5, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
          </div>
        </div>

        <div style={{ background: C.bg, borderRadius: 14, padding: "13px 14px", marginBottom: 10 }}>
          <p style={{ color: C.creamDim, fontSize: 11.5, margin: "0 0 7px" }}>Имя в семейной сводке</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text" value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Например: Мама"
              style={{ flex: 1, minWidth: 0, background: C.panel, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", color: C.cream, fontSize: 14.5, fontFamily: "inherit", outline: "none" }}
            />
            {changed && (
              <button onClick={() => onRename(editName)} style={{ background: C.mint, color: C.bg, border: "none", borderRadius: 10, padding: "0 14px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Check size={17} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9, background: C.bg, borderRadius: 14, padding: "13px 14px", marginBottom: 10 }}>
          <Clock size={15} color={C.mintDim} />
          <span style={{ color: C.cream, fontSize: 13.5 }}>Напоминание в {time}</span>
        </div>

        <p style={{ color: C.creamDim, fontSize: 11, margin: "0 2px 14px", lineHeight: 1.55, opacity: 0.85 }}>
          Записи сохраняются в семейном облаке и видны тому, кто настроил приложение.
        </p>

        {confirmOut ? (
          <div style={{ border: `1px solid ${C.warn}66`, borderRadius: 14, padding: "13px 14px" }}>
            <p style={{ color: C.cream, fontSize: 13.5, fontWeight: 600, margin: "0 0 5px" }}>Выйти из аккаунта?</p>
            <p style={{ color: C.creamDim, fontSize: 12, margin: "0 0 12px", lineHeight: 1.5 }}>
              Записи не удалятся — они сохранены в аккаунте и вернутся при следующем входе.
            </p>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={onSignOut} style={{ flex: 1, background: "transparent", color: C.warn, border: `1px solid ${C.warn}88`, borderRadius: 11, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Да, выйти</button>
              <button onClick={() => setConfirmOut(false)} style={{ flex: 1, background: "transparent", color: C.creamDim, border: `1px solid ${C.line}`, borderRadius: 11, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Отмена</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={() => setConfirmOut(true)} style={{ flex: 1, background: "transparent", color: C.creamDim, border: `1px solid ${C.line}`, borderRadius: 12, padding: "13px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Выйти</button>
            <button onClick={onClose} style={{ flex: 1, background: C.mint, color: C.bg, border: "none", borderRadius: 12, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Закрыть</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Вход по ссылке из письма: без паролей. Имя нужно для семейной сводки —
// чтобы в общих данных было видно, чья это запись.
function SignIn() {
  const [name, setName] = useState(() => storeGet(NAME_KEY) || "");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!e.includes("@") || e.length < 5) { setErr("Проверьте адрес почты"); return; }
    setBusy(true); setErr(null);
    storeSet(NAME_KEY, name.trim()); // переживёт переход по ссылке
    try { await supabase.auth.signOut(); } catch { /* старая анонимная сессия */ }
    const problem = await requestMagicLink(e);
    setBusy(false);
    if (problem) { setErr("Не получилось отправить письмо. Проверьте адрес и попробуйте ещё раз."); return; }
    setSent(true);
  };

  if (sent) return (
    <SetupShell title="Письмо отправлено"
      sub={`Откройте почту ${email.trim()} на этом устройстве и нажмите в письме кнопку входа. После этого вернитесь в приложение.`}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "15px 16px" }}>
        <p style={{ color: C.creamDim, fontSize: 12.5, margin: 0, lineHeight: 1.6 }}>
          Письмо не пришло за пару минут? Загляните в папку «Спам».
        </p>
      </div>
      <button onClick={() => setSent(false)} style={{
        width: "100%", marginTop: 14, background: "transparent", color: C.creamDim,
        border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px", fontSize: 13.5,
        fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>Изменить адрес</button>
    </SetupShell>
  );

  return (
    <SetupShell title="Ваш аккаунт"
      sub="Один раз войдите по ссылке из письма — без пароля. Так записи не потеряются при смене телефона и будут видны с любого вашего устройства.">
      <div style={{ background: C.panel, borderRadius: 16, border: `1px solid ${C.line}`, padding: "14px 16px", marginBottom: 10 }}>
        <p style={{ color: C.cream, fontSize: 14, fontWeight: 500, margin: "0 0 8px" }}>Как вас зовут?</p>
        <input
          type="text" value={name} placeholder="Например: Мама"
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "12px", color: C.cream, fontSize: 15, fontFamily: "inherit", outline: "none" }}
        />
        <p style={{ color: C.creamDim, fontSize: 11, margin: "7px 0 0", opacity: 0.8 }}>Имя видно в семейной сводке.</p>
      </div>
      <div style={{ background: C.panel, borderRadius: 16, border: `1px solid ${C.line}`, padding: "14px 16px" }}>
        <p style={{ color: C.cream, fontSize: 14, fontWeight: 500, margin: "0 0 8px" }}>Электронная почта</p>
        <input
          type="email" inputMode="email" autoCapitalize="none" value={email} placeholder="mama@mail.ru"
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "12px", color: C.cream, fontSize: 15, fontFamily: "inherit", outline: "none" }}
        />
      </div>
      {err && <p style={{ color: C.warn, fontSize: 12.5, margin: "10px 4px 0" }}>{err}</p>}
      <button onClick={send} disabled={busy} style={{
        width: "100%", marginTop: 16, background: C.mint, color: C.bg, border: "none", borderRadius: 16,
        padding: "17px", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        opacity: busy ? 0.6 : 1,
      }}>{busy ? "Отправляем…" : "Получить ссылку для входа"}</button>
      <p style={{ color: C.creamDim, fontSize: 10.5, textAlign: "center", margin: "13px 10px 0", lineHeight: 1.5, opacity: 0.85 }}>
        Ваши записи из этого телефона никуда не денутся — после входа они привяжутся к аккаунту.
      </p>
    </SetupShell>
  );
}

function SetupShell({ title, sub, children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>
      <div style={{ width: 402, minHeight: "100vh", padding: "0 24px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Heart size={22} color={C.mint} fill={C.mint} />
          <span style={{ color: C.cream, fontWeight: 700, fontSize: 18 }}>120 app</span>
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", color: C.cream, fontSize: 25, fontWeight: 500, lineHeight: 1.3, margin: "18px 0 10px" }}>{title}</h1>
        {sub && <p style={{ color: C.creamDim, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 22px" }}>{sub}</p>}
        {children}
      </div>
    </div>
  );
}

function SetupChoiceRow({ label, icon: RIcon, value, options, onChange }) {
  return (
    <div style={{ background: C.panel, borderRadius: 16, border: `1px solid ${C.line}`, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
        {RIcon && <RIcon size={16} color={C.mint} />}
        <span style={{ color: C.cream, fontSize: 14, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: "flex", gap: 7 }}>
        {options.map((o) => (
          <button key={String(o.v)} onClick={() => onChange(value === o.v ? null : o.v)} style={{
            flex: 1, padding: "12px 4px", borderRadius: 11, border: `1px solid ${value === o.v ? C.mint : C.line}`,
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            background: value === o.v ? C.mint : "transparent", color: value === o.v ? C.bg : C.creamDim,
          }}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}

function SetupNumRow({ label, value, onChange, placeholder, unit, maxLen }) {
  return (
    <div style={{ background: C.panel, borderRadius: 16, border: `1px solid ${C.line}`, padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: C.cream, fontSize: 14, fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="text" inputMode="numeric" placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => {
            const d = e.target.value.replace(/[^\d]/g, "").slice(0, maxLen);
            onChange(d === "" ? null : parseInt(d, 10));
          }}
          style={{ width: 86, textAlign: "center", background: C.bg, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "10px 6px", color: C.cream, fontSize: 17, fontWeight: 700, fontFamily: "inherit", outline: "none" }}
        />
        {unit && <span style={{ color: C.creamDim, fontSize: 13 }}>{unit}</span>}
      </div>
    </div>
  );
}

function SetupNav({ next, last, mode, onCancel }) {
  return (
    <>
      <button onClick={next} style={{
        width: "100%", marginTop: 16, background: C.mint, color: C.bg, border: "none", borderRadius: 16,
        padding: "17px", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>{last ? "Начать" : "Далее"} <ChevronRight size={18} /></button>
      <button onClick={next} style={{ width: "100%", marginTop: 10, background: "transparent", color: C.creamDim, border: "none", padding: "10px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
        Пропустить
      </button>
      {mode === "profile" && onCancel && (
        <button onClick={onCancel} style={{ width: "100%", background: "transparent", color: C.creamDim, border: "none", padding: "4px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: 0.7 }}>
          Вернуться к дневнику
        </button>
      )}
    </>
  );
}

function Setup({ mode = "full", onDone, onCancel }) {
  const [step, setStep] = useState(mode === "full" ? 0 : 1);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [profile, setProfile] = useState({ birthYear: null, gender: null, height: null, weight: null, smoking: null, alcohol: null });
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const isMorning = hour < 12;
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const finish = () => onDone(mode === "full" ? { time: timeStr, profile } : profile);
  const next = () => (step >= 3 ? finish() : setStep(step + 1));

  if (step === 0) return (
    <SetupShell title="В какое время вам удобно измерять давление каждый день?"
      sub="Измерения в одно и то же время точнее показывают ваши закономерности. Утро — до лекарств и кофе — обычно лучший выбор, но главное — постоянство.">
      <div style={{ background: C.panel, borderRadius: 22, border: `1px solid ${C.line}`, padding: "24px 20px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: C.mintDim, fontSize: 13, marginBottom: 14 }}>
          {isMorning ? <Sun size={16} /> : <Moon size={16} />}
          {isMorning ? "Утро" : "Вечер"}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <TimeSpin value={hour} onUp={() => setHour((h) => (h + 1) % 24)} onDown={() => setHour((h) => (h + 23) % 24)} pad />
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 44, color: C.cream }}>:</span>
          <TimeSpin value={minute} onUp={() => setMinute((m) => (m + 15) % 60)} onDown={() => setMinute((m) => (m + 45) % 60)} pad />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {[["08:00", 8, 0], ["09:00", 9, 0], ["20:00", 20, 0]].map(([label, h, m]) => (
          <button key={label} onClick={() => { setHour(h); setMinute(m); }} style={{
            flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
            background: timeStr === label ? C.mint : C.panel, color: timeStr === label ? C.bg : C.creamDim,
            border: `1px solid ${timeStr === label ? C.mint : C.line}`,
          }}>{label}</button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, padding: "0 4px" }}>
        <Bell size={15} color={C.mintDim} />
        <span style={{ color: C.creamDim, fontSize: 12.5, lineHeight: 1.5 }}>
          Каждый день в {timeStr} придёт напоминание измерить давление.
        </span>
      </div>
      <button onClick={() => setStep(1)} style={{
        width: "100%", marginTop: 22, background: C.mint, color: C.bg, border: "none", borderRadius: 16,
        padding: "18px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>Далее <ChevronRight size={18} /></button>
      <p style={{ color: C.creamDim, fontSize: 11, textAlign: "center", margin: "12px 12px 0", lineHeight: 1.5 }}>
        Время можно поменять в любой момент. Записи сохраняются в семейном облаке и видны тому, кто настроил приложение.
      </p>
    </SetupShell>
  );

  if (step === 1) return (
    <SetupShell title="Немного о вас" sub="Все поля можно пропустить. Это поможет точнее показать вашу картину и подготовить сводку для врача.">
      <SetupNumRow label="Год рождения" value={profile.birthYear} onChange={(v) => set("birthYear", v)} placeholder="1962" maxLen={4} />
      <SetupChoiceRow label="Пол" value={profile.gender} onChange={(v) => set("gender", v)}
        options={[{ v: "m", l: "Мужчина" }, { v: "f", l: "Женщина" }, { v: "na", l: "Не указывать" }]} />
      <SetupNav next={next} mode={mode} onCancel={onCancel} />
    </SetupShell>
  );

  if (step === 2) return (
    <SetupShell title="Рост, вес и курение" sub="Эти данные никуда не выводятся в приложении — они только делают сводку для врача полнее.">
      <SetupNumRow label="Рост" value={profile.height} onChange={(v) => set("height", v)} placeholder="170" unit="см" maxLen={3} />
      <SetupNumRow label="Вес" value={profile.weight} onChange={(v) => set("weight", v)} placeholder="78" unit="кг" maxLen={3} />
      <SetupChoiceRow label="Курение" value={profile.smoking} onChange={(v) => set("smoking", v)}
        options={[{ v: "yes", l: "Курю" }, { v: "no", l: "Не курю" }, { v: "quit", l: "Бросил(а)" }]} />
      <SetupNav next={next} mode={mode} onCancel={onCancel} />
    </SetupShell>
  );

  return (
    <SetupShell title="Употребляете ли вы алкоголь?"
      sub="Алкоголь заметно влияет на давление. Если ответите «да», в дневнике появится короткий вопрос о нём — это поможет увидеть связь.">
      <SetupChoiceRow label="Алкоголь" icon={Wine} value={profile.alcohol} onChange={(v) => set("alcohol", v)}
        options={[{ v: "yes", l: "Да" }, { v: "no", l: "Нет" }, { v: "na", l: "Не указывать" }]} />
      <SetupNav next={next} last mode={mode} onCancel={onCancel} />
    </SetupShell>
  );
}

function TimeSpin({ value, onUp, onDown, pad }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button onClick={onUp} style={{ width: 52, height: 40, borderRadius: 11, background: C.panelSoft, border: `1px solid ${C.line}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Plus size={19} color={C.cream} />
      </button>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: 48, color: C.cream, fontWeight: 500, minWidth: 62, textAlign: "center" }}>
        {pad ? String(value).padStart(2, "0") : value}
      </span>
      <button onClick={onDown} style={{ width: 52, height: 40, borderRadius: 11, background: C.panelSoft, border: `1px solid ${C.line}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Minus size={19} color={C.cream} />
      </button>
    </div>
  );
}

function BigStepper({ label, value, setValue, min, max, step }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = React.useRef(null);

  const beginEdit = () => { setDraft(String(value)); setEditing(true); };
  const commit = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n)) setValue(Math.min(max, Math.max(min, n))); // держим в допустимых пределах
    setEditing(false);
  };

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editing]);

  return (
    <div style={{ marginBottom: 12 }}>
      <span style={{ color: C.creamDim, fontSize: 13, display: "block", marginBottom: 7 }}>{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          style={{
            width: "100%", boxSizing: "border-box", textAlign: "center", background: C.bg, borderRadius: 12,
            padding: "14px 0", color: C.cream, fontSize: 26, fontWeight: 700, fontFamily: "inherit",
            border: `2px solid ${C.mint}`, outline: "none",
          }}
        />
      ) : (
        <button
          onClick={beginEdit}
          aria-label={`${label}: ${value}. Нажмите, чтобы ввести число`}
          style={{
            width: "100%", textAlign: "center", background: C.bg, borderRadius: 12, padding: "14px 0",
            color: C.cream, fontSize: 26, fontWeight: 700, fontFamily: "inherit",
            border: `1.5px solid ${C.line}`, cursor: "pointer", position: "relative",
          }}
        >
          {value}
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: C.creamDim, fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
            изменить
          </span>
        </button>
      )}
    </div>
  );
}

// Кнопка с удержанием: нажал и держишь — значение меняется всё быстрее.
function RoundBtn({ children, onClick, ariaLabel }) {
  const timer = React.useRef(null);
  const delay = React.useRef(300);

  const stop = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    delay.current = 300;
  };

  const start = (e) => {
    e.preventDefault();       // не даём телефону выделять текст / зумить
    onClick();                // первое нажатие — сразу
    const tick = () => {
      onClick();
      delay.current = Math.max(40, delay.current * 0.75); // разгон
      timer.current = setTimeout(tick, delay.current);
    };
    timer.current = setTimeout(tick, 400); // пауза перед автоповтором
  };

  React.useEffect(() => stop, []);

  return (
    <button
      aria-label={ariaLabel}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: 48, height: 48, borderRadius: 14, background: C.panelSoft, border: `1px solid ${C.line}`,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
        touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
      }}
    >{children}</button>
  );
}

function FactorRow({ f, morning, value, setValue }) {
  const Icon = f.icon;
  const label = morning && f.labelMorning ? f.labelMorning : f.label;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = React.useRef(null);

  const beginEdit = () => { setDraft(String(value)); setEditing(true); };
  const commit = () => {
    // Русская клавиатура часто даёт запятую: «6,5» → приводим к точке.
    const cleaned = draft.replace(",", ".");
    const n = f.step < 1 ? parseFloat(cleaned) : parseInt(cleaned, 10);
    if (!isNaN(n)) setValue(Math.min(f.max, Math.max(f.min, n)));
    setEditing(false);
  };
  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editing]);

  if (f.type === "choice") {
    return (
      <div style={{ background: C.panel, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <Icon size={17} color={C.mint} /><span style={{ color: C.cream, fontSize: 14.5, fontWeight: 500 }}>{label}</span>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {f.options.map((o) => (
            <button key={o.v} onClick={() => setValue(o.v)} style={{
              flex: 1, padding: "13px 0", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 13.5, fontWeight: 700, background: value === o.v ? C.mint : C.bg, color: value === o.v ? C.bg : C.creamDim,
            }}>{o.l}</button>
          ))}
        </div>
      </div>
    );
  }
  if (f.type === "scale") {
    return (
      <div style={{ background: C.panel, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <Icon size={17} color={C.mint} /><span style={{ color: C.cream, fontSize: 14.5, fontWeight: 500 }}>{label}</span>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setValue(n)} style={{
              flex: 1, padding: "13px 0", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 16, fontWeight: 700, background: value === n ? C.mint : C.bg, color: value === n ? C.bg : C.creamDim,
            }}>{n}</button>
          ))}
        </div>
        {f.hint && (
          <p style={{ color: C.creamDim, fontSize: 10.5, margin: "8px 2px 0", opacity: 0.75, lineHeight: 1.4 }}>{f.hint}</p>
        )}
      </div>
    );
  }
  const big = f.type === "steps";
  return (
    <div style={{ background: C.panel, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon size={17} color={C.mint} /><span style={{ color: C.cream, fontSize: 14.5, fontWeight: 500 }}>{label}</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RoundBtn ariaLabel="Уменьшить" onClick={() => setValue((v) => Math.max(f.min, +(v - f.step).toFixed(1)))}><Minus size={18} color={C.cream} /></RoundBtn>
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              inputMode={f.step < 1 ? "decimal" : "numeric"}
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
              style={{
                width: big ? 78 : 56, textAlign: "center", background: C.bg, borderRadius: 9, padding: "6px 2px",
                color: C.cream, fontSize: big ? 17 : 19, fontWeight: 700, fontFamily: "inherit",
                border: `2px solid ${C.mint}`, outline: "none",
              }}
            />
          ) : (
            <button
              onClick={beginEdit}
              aria-label={`${label}: ${value}. Нажмите, чтобы ввести число`}
              style={{
                background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 9, padding: "6px 8px",
                color: C.cream, fontSize: big ? 18 : 20, fontWeight: 700, minWidth: big ? 74 : 66,
                textAlign: "center", cursor: "pointer", fontFamily: "inherit",
              }}
            >{big ? fmtNum(value) : value}{f.suffix ? ` ${f.suffix}` : ""}</button>
          )}
          <RoundBtn ariaLabel="Увеличить" onClick={() => setValue((v) => Math.min(f.max, +(v + f.step).toFixed(1)))}><Plus size={18} color={C.cream} /></RoundBtn>
        </div>
      </div>
      {f.hint && <p style={{ color: C.creamDim, fontSize: 10.5, margin: "8px 0 0", opacity: 0.75, lineHeight: 1.4 }}>{f.hint}</p>}
      {big && <p style={{ color: C.creamDim, fontSize: 11, margin: "9px 0 0" }}>Позже — автоматически с часов или телефона</p>}
    </div>
  );
}

// Редактор одного дня: исправить существующую запись или заполнить пропущенную.
// Использует те же элементы управления, что и «Сегодня».
function EditDay({ day, activeFactors, onSave, onCancel }) {
  const { dateISO, entry } = day;
  const isNew = !entry;
  const [sys, setSys] = useState(entry ? entry.sys : 128);
  const [dia, setDia] = useState(entry ? entry.dia : 82);
  const [taken, setTaken] = useState(entry ? !!entry.taken : true);
  const [factors, setFactors] = useState(() =>
    Object.fromEntries(activeFactors.map((f) => [f.key, entry && entry[f.key] != null ? entry[f.key] : f.def]))
  );
  const d = new Date(dateISO);
  const title = (isNew ? "Добавить запись за " : "Запись за ") + d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  const save = () => onSave({
    date: entry ? entry.date : dateISO, // у существующей записи сохраняем исходное время
    sys, dia, taken,
    ...Object.fromEntries(activeFactors.map((f) => [f.key, factors[f.key]])),
  });

  return (
    <SetupShell
      title={title}
      sub={isNew
        ? "Заполните по памяти — примерные значения лучше, чем пропуск."
        : "Исправьте значения и сохраните."}
    >
      <div style={{ background: C.panel, borderRadius: 20, padding: "20px", border: `1px solid ${C.line}`, marginBottom: 10 }}>
        <BigStepper label="Верхнее (систолическое)" value={sys} setValue={setSys} min={80} max={200} step={1} />
        <BigStepper label="Нижнее (диастолическое)" value={dia} setValue={setDia} min={40} max={130} step={1} />
      </div>

      <button onClick={() => setTaken((m) => !m)} style={{
        width: "100%", background: C.panel, border: `1px solid ${taken ? C.mintDim : C.line}`,
        borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer", fontFamily: "inherit", marginBottom: 10,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Pill size={17} color={taken ? C.mint : C.creamDim} />
          <span style={{ color: C.cream, fontSize: 14, fontWeight: 500 }}>Лекарство в этот день</span>
        </span>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: taken ? C.mint : "transparent", border: `1px solid ${taken ? C.mint : C.creamDim}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {taken && <Check size={16} color={C.bg} strokeWidth={3} />}
        </span>
      </button>

      <div style={{ display: "grid", gap: 10 }}>
        {activeFactors.map((f) => (
          <FactorRow
            key={f.key}
            f={f}
            morning={false} /* редактируем конкретную дату — метки без «вчера» */
            value={factors[f.key]}
            setValue={(next) => setFactors((s) => ({
              ...s,
              [f.key]: typeof next === "function" ? next(s[f.key]) : next,
            }))}
          />
        ))}
      </div>

      <button onClick={save} style={{
        width: "100%", marginTop: 16, background: C.mint, color: C.bg, border: "none", borderRadius: 16,
        padding: "17px", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <Check size={18} strokeWidth={3} /> Сохранить
      </button>
      <button onClick={onCancel} style={{
        width: "100%", marginTop: 10, background: "transparent", color: C.creamDim, border: `1px solid ${C.line}`,
        borderRadius: 14, padding: "13px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>
        Отмена
      </button>
    </SetupShell>
  );
}

function TrendView({ history, fact, onPick }) {
  const rows = history.slice(-14);

  // Последние 7 календарных дней: записи можно исправить, пропуски — заполнить.
  const dayList = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toDateString();
    return { d, entry: history.find((r) => new Date(r.date).toDateString() === ds) || null, idx: i };
  });
  const dayLabel = (d, idx) =>
    idx === 0 ? "Сегодня" : idx === 1 ? "Вчера"
      : d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });

  const factCard = (
    <div style={{ marginTop: 12, background: `${C.mint}12`, border: `1px solid ${C.mintDim}44`, borderRadius: 16, padding: "15px 16px", display: "flex", gap: 12 }}>
      <div style={{ minWidth: 34, height: 34, borderRadius: 10, background: `${C.mint}22`, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }}>
        <Lightbulb size={18} color={C.mint} />
      </div>
      <div>
        <p style={{ color: C.mint, fontSize: 11.5, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>Полезно знать</p>
        <p style={{ color: C.cream, fontSize: 13, margin: 0, lineHeight: 1.55 }}>{fact}</p>
      </div>
    </div>
  );

  let chartBlock;
  if (rows.length < 2) {
    chartBlock = (
      <div style={{ background: C.panel, borderRadius: 20, padding: "28px 20px", border: `1px solid ${C.line}`, textAlign: "center" }}>
        <p style={{ color: C.cream, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>График появится после второй записи</p>
        <p style={{ color: C.creamDim, fontSize: 13, margin: 0, lineHeight: 1.55 }}>
          Сохраняйте измерение каждый день — и здесь будет видно, как меняется ваше давление.
        </p>
      </div>
    );
  } else {
    const max = Math.max(...rows.map((r) => r.sys)) + 6;
    const min = Math.min(...rows.map((r) => r.dia)) - 6;
    const H = 150, W = 340, step = W / (rows.length - 1);
    const y = (v) => H - ((v - min) / (max - min)) * H;
    const path = (key) => rows.map((r, i) => `${i === 0 ? "M" : "L"} ${i * step} ${y(r[key])}`).join(" ");
    chartBlock = (
      <div style={{ background: C.panel, borderRadius: 20, padding: "20px 18px 14px", border: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ color: C.cream, fontSize: 15, fontWeight: 600 }}>Последние 14 дней</span>
          <span style={{ display: "flex", gap: 12 }}><Legend color={C.coral} label="Верхнее" /><Legend color={C.mint} label="Нижнее" /></span>
        </div>
        <svg viewBox={`0 -6 ${W} ${H + 24}`} width="100%" style={{ overflow: "visible" }}>
          {[120, 140].map((g) => (
            <g key={g}>
              <line x1={0} x2={W} y1={y(g)} y2={y(g)} stroke={C.line} strokeDasharray="3 4" />
              <text x={0} y={y(g) - 4} fill={C.creamDim} fontSize={10}>{g}</text>
            </g>
          ))}
          <path d={path("sys")} fill="none" stroke={C.coral} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <path d={path("dia")} fill="none" stroke={C.mint} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {rows.map((r, i) => (<g key={i}><circle cx={i * step} cy={y(r.sys)} r={2.8} fill={C.coral} /><circle cx={i * step} cy={y(r.dia)} r={2.8} fill={C.mint} /></g>))}
        </svg>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 18px 0" }}>
      {chartBlock}
      {factCard}

      <p style={{ color: C.creamDim, fontSize: 12.5, margin: "22px 4px 4px", textTransform: "uppercase", letterSpacing: 0.6 }}>Последние 7 дней</p>
      <p style={{ color: C.creamDim, fontSize: 11, margin: "0 4px 10px", opacity: 0.75 }}>Нажмите на запись, чтобы исправить, или добавьте пропущенный день.</p>
      {dayList.map(({ d, entry, idx }) => entry ? (
        <button
          key={idx}
          onClick={() => onPick(entry.date, entry)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", background: C.panel, borderRadius: 14, marginBottom: 8,
            border: `1px solid ${C.line}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}
        >
          <div>
            <span style={{ color: C.cream, fontSize: 15, fontWeight: 700 }}>{entry.sys}/{entry.dia}</span>
            <span style={{ color: C.creamDim, fontSize: 12, marginLeft: 8 }}>{dayLabel(d, idx)}</span>
          </div>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            {entry.steps != null && <MiniStat icon={Footprints} v={fmtNum(entry.steps)} />}
            {entry.sleep != null && <MiniStat icon={Moon} v={`${entry.sleep}ч`} />}
            <Pill size={15} color={entry.taken ? C.mintDim : "#8A5A55"} />
            <ChevronRight size={16} color={C.creamDim} />
          </div>
        </button>
      ) : (
        <button
          key={idx}
          onClick={() => onPick(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString(), null)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", background: "transparent", borderRadius: 14, marginBottom: 8,
            border: `1px dashed ${C.line}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}
        >
          <span style={{ color: C.creamDim, fontSize: 13 }}>
            {dayLabel(d, idx)} — нет записи
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: C.mint, fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> Добавить
          </span>
        </button>
      ))}
    </div>
  );
}

function MiniStat({ icon: Icon, v }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon size={14} color={C.creamDim} /><span style={{ color: C.creamDim, fontSize: 11.5 }}>{v}</span></span>;
}
function Legend({ color, label }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 99, background: color }} /><span style={{ color: C.creamDim, fontSize: 11 }}>{label}</span></span>;
}

function InsightView({ history, insight, daysLogged }) {
  // Не показываем «закономерность» раньше 14 дней: четыре фактора соревнуются,
  // и на малой выборке «победитель» слишком часто оказывается случайным.
  if (daysLogged < 14) {
    const left = 14 - daysLogged;
    const obs = microObservations(history);
    const obsIcons = { low: TrendingDown, avg: Sparkles, med: Pill };
    return (
      <div style={{ padding: "12px 18px 0" }}>
        <div style={{ background: `linear-gradient(160deg, ${C.panelSoft}, ${C.panel})`, borderRadius: 22, padding: "26px 20px", border: `1px solid ${C.mintDim}55`, textAlign: "center" }}>
          <Sparkles size={22} color={C.mint} style={{ marginBottom: 10 }} />
          <p style={{ fontFamily: "'Fraunces', serif", color: C.cream, fontSize: 21, fontWeight: 500, lineHeight: 1.35, margin: "0 0 8px" }}>
            {left <= 3 ? "Почти готово" : "Собираем вашу картину"}
          </p>
          <p style={{ color: C.creamDim, fontSize: 13.5, margin: "0 0 18px", lineHeight: 1.6 }}>
            Ещё {left} {pluralZapisey(left)} — и появится ваша первая закономерность.
          </p>
          {/* 14 точек: заполненные — дни с записями */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} style={{
                width: 10, height: 10, borderRadius: 99,
                background: i < daysLogged ? C.mint : "transparent",
                border: `1.5px solid ${i < daysLogged ? C.mint : C.line}`,
                transition: "all .3s",
              }} />
            ))}
          </div>
        </div>

        {obs.length > 0 && (
          <>
            <p style={{ color: C.creamDim, fontSize: 12.5, margin: "20px 4px 10px", textTransform: "uppercase", letterSpacing: 0.6 }}>
              А пока — из ваших записей
            </p>
            {obs.map((o, i) => {
              const OIcon = obsIcons[o.icon] || Sparkles;
              return (
                <div key={i} style={{ background: C.panel, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.line}`, marginBottom: 8, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 32, height: 32, borderRadius: 9, background: `${C.mint}1A`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <OIcon size={16} color={C.mint} />
                  </div>
                  <p style={{ color: C.cream, fontSize: 13.5, margin: "5px 0 0", lineHeight: 1.5 }}>{o.text}</p>
                </div>
              );
            })}
            <p style={{ color: C.creamDim, fontSize: 11, margin: "10px 4px 0", opacity: 0.8, lineHeight: 1.5 }}>
              Это просто наблюдения, а не выводы — выводы появятся, когда данных станет больше.
            </p>
          </>
        )}
      </div>
    );
  }

  // 14+ дней, но ни один фактор пока не менялся достаточно, чтобы сравнивать.
  if (!insight) {
    return (
      <div style={{ padding: "12px 18px 0" }}>
        <div style={{ background: `linear-gradient(160deg, ${C.panelSoft}, ${C.panel})`, borderRadius: 22, padding: "26px 20px", border: `1px solid ${C.mintDim}55`, textAlign: "center" }}>
          <Sparkles size={22} color={C.mint} style={{ marginBottom: 10 }} />
          <p style={{ fontFamily: "'Fraunces', serif", color: C.cream, fontSize: 21, fontWeight: 500, lineHeight: 1.35, margin: "0 0 8px" }}>
            Пока картина ровная
          </p>
          <p style={{ color: C.creamDim, fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
            Ваши привычки день ото дня почти не менялись, поэтому связей пока не видно. Со временем, когда дни станут разнообразнее, закономерности проявятся.
          </p>
        </div>
      </div>
    );
  }

  const factorKey = insight.key;
  // Для необязательных факторов (алкоголь) берём только записи, где он заполнен.
  const pts = history.filter((r) => r[factorKey] != null).map((r) => ({ x: r[factorKey], y: r.sys }));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys) - 4, yMax = Math.max(...ys) + 4;
  const W = 320, H = 150;
  const px = (x) => ((x - xMin) / (xMax - xMin || 1)) * W;
  const py = (y) => H - ((y - yMin) / (yMax - yMin || 1)) * H;

  const strength = Math.abs(insight.r);
  const strengthLabel = strength > 0.5 ? "чёткая закономерность" : strength > 0.3 ? "первая закономерность" : "слабая связь";
  const xLo = Math.min(...xs);
  const mid = (xLo + Math.max(...xs)) / 2;
  // «Высокая» группа — строго выше минимума и не ниже середины, как в отборе факторов.
  const hi = ys.filter((_, i) => xs[i] >= mid && xs[i] !== xLo);
  const lo = ys.filter((_, i) => xs[i] < mid || xs[i] === xLo);
  const avgHi = hi.length ? Math.round(hi.reduce((a, b) => a + b, 0) / hi.length) : 0;
  const avgLo = lo.length ? Math.round(lo.reduce((a, b) => a + b, 0) / lo.length) : 0;
  // Обе группы непусты (гарантировано отбором usable), но на всякий случай:
  const gap = hi.length && lo.length ? Math.abs(avgHi - avgLo) : 0;

  // Направление берём ИЗ ДАННЫХ, а не из ожиданий.
  const higherOnMore = avgHi > avgLo;           // больше фактора → давление выше?
  const dirWord = higherOnMore ? "выше" : "ниже";
  const dataSign = higherOnMore ? 1 : -1;
  // Неожиданно = данные разошлись с обычным медицинским ожиданием.
  // При нулевой разнице направления нет — нечего и флагать.
  const unexpected = gap > 0 && insight.expected !== 0 && dataSign !== insight.expected;

  // Описания групп — нейтральные, без намёка на давление.
  const groups = {
    sleep: { more: "В дни, когда вы спали дольше", less: "в дни, когда вы спали меньше" },
    steps: { more: "В дни, когда вы больше ходили", less: "в дни, когда вы ходили меньше" },
    stress: { more: "В более напряжённые дни", less: "в спокойные дни" },
    salt: { more: "В дни с солёной едой", less: "в дни с лёгкой едой" },
    alcohol: { more: "В дни с алкоголем", less: "в дни без алкоголя" },
  }[factorKey];

  // Подсказка следует за данными. При неожиданном направлении — не советуем
  // ничего менять, а предлагаем продолжить наблюдение и спросить врача.
  const nudgeExpected = {
    sleep: "Похоже, сон — один из ваших сильных рычагов. Попробуйте ложиться в одно и то же время.",
    steps: "Похоже, ходьба вам заметно помогает. Даже небольшая ежедневная прогулка — хороший шаг.",
    stress: "В напряжённые дни попробуйте несколько минут спокойствия перед сном.",
    salt: "Немного меньше соли несколько дней в неделю — маленький и выполнимый шаг.",
    alcohol: "Похоже, алкоголь заметно отражается на ваших цифрах. Пара безалкогольных дней подряд — хороший способ это проверить.",
  }[factorKey];

  return (
    <div style={{ padding: "12px 18px 0" }}>
      <div style={{ background: `linear-gradient(160deg, ${C.panelSoft}, ${C.panel})`, borderRadius: 22, padding: "22px 20px", border: `1px solid ${C.mintDim}55` }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, color: C.mint, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7 }}>
          <Sparkles size={15} /> Ваша закономерность
        </span>
        <h2 style={{ fontFamily: "'Fraunces', serif", color: C.cream, fontSize: 23, fontWeight: 500, lineHeight: 1.3, margin: "12px 0 8px" }}>
          {gap === 0
            ? <>{groups.more} и {groups.less} давление у вас <span style={{ color: C.coral }}>практически одинаковое</span>.</>
            : <>{groups.more} давление примерно <span style={{ color: C.coral }}>на {gap} единиц {dirWord}</span>, чем {groups.less}.</>}
        </h2>
        <p style={{ color: C.creamDim, fontSize: 13, margin: "6px 0 0" }}>
          За {daysLogged} дней видна {strengthLabel} между вашим уровнем {insight.label} и давлением.
        </p>

        <div style={{ marginTop: 18, background: C.bg, borderRadius: 14, padding: "14px 12px 8px" }}>
          <svg viewBox={`-6 -8 ${W + 12} ${H + 28}`} width="100%">
            <line x1={0} y1={H} x2={W} y2={H} stroke={C.line} />
            {(() => {
              const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
              let num = 0, den = 0;
              for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
              const slope = num / (den || 1), b = my - slope * mx;
              return <line x1={px(xMin)} y1={py(slope * xMin + b)} x2={px(xMax)} y2={py(slope * xMax + b)} stroke={C.mint} strokeWidth={2} strokeDasharray="5 4" opacity={0.8} />;
            })()}
            {pts.map((p, i) => <circle key={i} cx={px(p.x)} cy={py(p.y)} r={4} fill={C.coral} opacity={0.75} />)}
            <text x={0} y={H + 18} fill={C.creamDim} fontSize={10}>меньше {insight.label}</text>
            <text x={W} y={H + 18} fill={C.creamDim} fontSize={10} textAnchor="end">больше {insight.label}</text>
          </svg>
        </div>
      </div>

      <div style={{ background: C.panel, borderRadius: 18, padding: "16px", border: `1px solid ${unexpected ? C.warn + "66" : C.line}`, marginTop: 12, display: "flex", gap: 12 }}>
        <div style={{ minWidth: 36, height: 36, borderRadius: 10, background: unexpected ? `${C.warn}1E` : `${C.mint}1E`, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }}>
          {unexpected ? <Info size={19} color={C.warn} /> : <TrendingDown size={19} color={C.mint} />}
        </div>
        <div>
          <p style={{ color: C.cream, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>
            {unexpected ? "Неожиданный результат" : "Что можно попробовать"}
          </p>
          <p style={{ color: C.creamDim, fontSize: 13, margin: 0, lineHeight: 1.55 }}>
            {unexpected
              ? "Обычно это работает наоборот. За несколько недель такое часто оказывается случайностью — продолжайте вести дневник и покажите эту картину врачу. Не меняйте привычки только из-за этого наблюдения."
              : nudgeExpected}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "flex-start", padding: "13px 15px", borderRadius: 14, border: `1px dashed ${C.line}` }}>
        <Info size={16} color={C.creamDim} style={{ marginTop: 1, minWidth: 16 }} />
        <p style={{ color: C.creamDim, fontSize: 11.5, margin: 0, lineHeight: 1.55 }}>
          Это закономерности в ваших данных, а не медицинский совет. Если давление остаётся высоким или вы плохо себя чувствуете — обратитесь к врачу или в скорую помощь.
        </p>
      </div>

      <button style={{
        width: "100%", marginTop: 14, background: "transparent", color: C.mint, border: `1px solid ${C.mintDim}66`,
        borderRadius: 14, padding: "15px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
      }}>
        Показать сводку врачу <ChevronRight size={17} />
      </button>
    </div>
  );
}
