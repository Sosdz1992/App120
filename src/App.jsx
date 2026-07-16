import React, { useState, useMemo, useEffect } from "react";
import {
  Moon, Footprints, Brain, Utensils, Pill, Heart, ChevronRight,
  Check, Sparkles, TrendingDown, Info, Plus, Minus, Lightbulb,
  Clock, Bell, Sun
} from "lucide-react";

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
function loadSettings() {
  try {
    const raw = storeGet(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function persistSettings(s) {
  try { storeSet(SETTINGS_KEY, JSON.stringify(s)); } catch { /* no-op */ }
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
];

const FACTORS = [
  { key: "sleep", label: "Сон", labelMorning: "Сон этой ночью", icon: Moon, unit: "ч", min: 3, max: 11, step: 0.5, def: 7, type: "stepper" },
  { key: "steps", label: "Шаги", labelMorning: "Шаги вчера", icon: Footprints, unit: "", min: 0, max: 20000, step: 500, def: 3000, type: "steps" },
  { key: "stress", label: "Стресс", labelMorning: "Стресс вчера", icon: Brain, unit: "из 5", min: 1, max: 5, step: 1, def: 3, type: "scale" },
  { key: "salt", label: "Солёная еда", labelMorning: "Солёная еда вчера", icon: Utensils, unit: "из 5", min: 1, max: 5, step: 1, def: 2, type: "scale" },
];

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

export default function App() {
  const [tab, setTab] = useState("log");
  const [history, setHistory] = useState(() => loadEntries() || (DEMO_MODE ? makeHistory() : []));
  const [sys, setSys] = useState(128);
  const [dia, setDia] = useState(82);
  const [factors, setFactors] = useState(Object.fromEntries(FACTORS.map((f) => [f.key, f.def])));
  const [medTaken, setMedTaken] = useState(true);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => { persist(history); }, [history]);
  useEffect(() => { if (settings) persistSettings(settings); }, [settings]);

  // Has today's entry already been logged? (drives reminder banner)
  const loggedToday = useMemo(() => {
    const today = new Date().toDateString();
    return history.some((r) => new Date(r.date).toDateString() === today) || saved;
  }, [history, saved]);

  // Classified by the HIGHER of the two values (ESH-style grading).
  const bpBand = useMemo(() => {
    if (sys >= 180 || dia >= 110) return { label: "Очень высокое — к врачу", color: "#EC7A6A" };
    if (sys >= 160 || dia >= 100) return { label: "2 степень", color: "#EC7A6A" };
    if (sys >= 140 || dia >= 90) return { label: "1 степень", color: C.coral };
    if (sys >= 130 || dia >= 85) return { label: "Повышенное", color: C.warn };
    return { label: "Норма", color: C.good };
  }, [sys, dia]);

  const insight = useMemo(() => {
    const sysArr = history.map((r) => r.sys);
    // Все четыре фактора соревнуются на равных. `expected` — только для того,
    // чтобы честно отметить неожиданный результат, а НЕ чтобы навязать направление.
    const cands = [
      { key: "sleep", label: "сна", expected: -1, arr: history.map((r) => r.sleep) },
      { key: "steps", label: "шагов", expected: -1, arr: history.map((r) => r.steps) },
      { key: "stress", label: "стресса", expected: 1, arr: history.map((r) => r.stress) },
      { key: "salt", label: "солёной еды", expected: 1, arr: history.map((r) => r.salt) },
    ].map((c) => ({ ...c, r: pearson(c.arr, sysArr) }));
    cands.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return cands[0];
  }, [history]);

  const daysLogged = history.length;
  const progress = Math.min(100, Math.round((daysLogged / 60) * 100));
  const fact = FACTS[daysLogged % FACTS.length];

  const saveEntry = () => {
    const todayStr = new Date().toDateString();
    const entry = { date: new Date().toISOString(), sys, dia, ...factors, taken: medTaken };
    // Одна запись в день: повторное сохранение обновляет сегодняшнюю.
    setHistory((h) => [...h.filter((r) => new Date(r.date).toDateString() !== todayStr), entry]);
    setSaved(true);
    setTimeout(() => setTab("insight"), 600);
  };

  // First run: pick the daily reading time before anything else.
  if (!settings) {
    return <Setup onDone={(time) => setSettings({ time, reminderOn: true })} />;
  }

  // Утреннее измерение → вопросы про вчерашний день и прошедшую ночь.
  const morning = parseInt(settings.time.split(":")[0], 10) < 12;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .phone::-webkit-scrollbar{ display:none; }
        @media (prefers-reduced-motion: reduce){ *{ transition:none !important; } }
        button:focus-visible{ outline:3px solid ${C.mint}; outline-offset:2px; }
      `}</style>

      <div className="phone" style={{
        width: 402, minHeight: "100vh", background: C.bg, position: "relative",
        overflowY: "auto", borderLeft: `1px solid ${C.line}`, borderRight: `1px solid ${C.line}`, paddingBottom: 40,
      }}>
        {/* Header */}
        <div style={{ padding: "26px 24px 6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Heart size={20} color={C.mint} fill={C.mint} />
            <span style={{ color: C.cream, fontWeight: 700, fontSize: 17 }}>120 app</span>
          </div>
          <p style={{ color: C.creamDim, fontSize: 13.5, margin: "5px 0 0", paddingLeft: 29 }}>
            {daysLogged} дней наблюдений
          </p>
        </div>

        {/* Progress */}
        <div style={{ padding: "10px 24px 4px" }}>
          <div style={{ height: 6, background: C.line, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: `linear-gradient(90deg, ${C.mintDim}, ${C.mint})`, borderRadius: 99, transition: "width .5s" }} />
          </div>
          <p style={{ color: C.mintDim, fontSize: 12, margin: "7px 2px 0" }}>
            {progress}% пути к полной картине за 3 месяца
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
              {FACTORS.map((f) => (
                <FactorRow key={f.key} f={f} morning={morning} value={factors[f.key]} setValue={(v) => setFactors((s) => ({ ...s, [f.key]: v }))} />
              ))}
            </div>

            <button onClick={saveEntry} style={{
              width: "100%", marginTop: 18, background: C.mint, color: C.bg, border: "none", borderRadius: 16,
              padding: "18px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {saved ? <><Check size={20} strokeWidth={3} /> Сохранено</> : "Сохранить запись"}
            </button>
            <p style={{ color: C.creamDim, fontSize: 11.5, textAlign: "center", margin: "13px 8px 8px", lineHeight: 1.5 }}>
              Приложение помогает замечать ваши собственные закономерности. Оно не заменяет врача — обсуждайте измерения с лечащим врачом.
            </p>
          </div>
        )}

        {tab === "trend" && <TrendView history={history} fact={fact} />}
        {tab === "insight" && <InsightView history={history} insight={insight} daysLogged={daysLogged} />}
      </div>
    </div>
  );
}

function Setup({ onDone }) {
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const isMorning = hour < 12;

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

        <h1 style={{ fontFamily: "'Fraunces', serif", color: C.cream, fontSize: 27, fontWeight: 500, lineHeight: 1.3, margin: "18px 0 10px" }}>
          В какое время вам удобно измерять давление каждый день?
        </h1>
        <p style={{ color: C.creamDim, fontSize: 14, lineHeight: 1.55, margin: "0 0 26px" }}>
          Измерения в одно и то же время точнее показывают ваши закономерности. Утро — до лекарств и кофе — обычно лучший выбор, но главное — постоянство.
        </p>

        {/* Big time display */}
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

        {/* Quick presets */}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {[["08:00", 8, 0], ["09:00", 9, 0], ["20:00", 20, 0]].map(([label, h, m]) => (
            <button key={label} onClick={() => { setHour(h); setMinute(m); }} style={{
              flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
              background: timeStr === label ? C.mint : C.panel, color: timeStr === label ? C.bg : C.creamDim,
              border: `1px solid ${timeStr === label ? C.mint : C.line}`,
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22, padding: "0 4px" }}>
          <Bell size={15} color={C.mintDim} />
          <span style={{ color: C.creamDim, fontSize: 12.5, lineHeight: 1.5 }}>
            Каждый день в {timeStr} придёт напоминание измерить давление.
          </span>
        </div>

        <button onClick={() => onDone(timeStr)} style={{
          width: "100%", marginTop: 24, background: C.mint, color: C.bg, border: "none", borderRadius: 16,
          padding: "18px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          Начать <ChevronRight size={18} />
        </button>
        <p style={{ color: C.creamDim, fontSize: 11, textAlign: "center", margin: "14px 12px 0", lineHeight: 1.5 }}>
          Время можно поменять в любой момент. О времени измерения стоит спросить у лечащего врача.
        </p>
      </div>
    </div>
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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <RoundBtn ariaLabel="Уменьшить" onClick={() => setValue((v) => Math.max(min, v - step))}><Minus size={20} color={C.cream} /></RoundBtn>

        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            style={{
              flex: 1, textAlign: "center", background: C.bg, borderRadius: 12, padding: "10px 0",
              color: C.cream, fontSize: 22, fontWeight: 700, fontFamily: "inherit",
              border: `2px solid ${C.mint}`, outline: "none", minWidth: 0,
            }}
          />
        ) : (
          <button
            onClick={beginEdit}
            aria-label={`${label}: ${value}. Нажмите, чтобы ввести число`}
            style={{
              flex: 1, textAlign: "center", background: C.bg, borderRadius: 12, padding: "10px 0",
              color: C.cream, fontSize: 22, fontWeight: 700, fontFamily: "inherit",
              border: `1px dashed ${C.line}`, cursor: "pointer",
            }}
          >{value}</button>
        )}

        <RoundBtn ariaLabel="Увеличить" onClick={() => setValue((v) => Math.min(max, v + step))}><Plus size={20} color={C.cream} /></RoundBtn>
      </div>
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
    const n = f.step < 1 ? parseFloat(draft) : parseInt(draft, 10);
    if (!isNaN(n)) setValue(Math.min(f.max, Math.max(f.min, n)));
    setEditing(false);
  };
  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editing]);

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
              type="number"
              inputMode={f.step < 1 ? "decimal" : "numeric"}
              step={f.step}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
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
                color: C.cream, fontSize: big ? 18 : 20, fontWeight: 700, minWidth: big ? 74 : 52,
                textAlign: "center", cursor: "pointer", fontFamily: "inherit",
              }}
            >{big ? fmtNum(value) : value}</button>
          )}
          <RoundBtn ariaLabel="Увеличить" onClick={() => setValue((v) => Math.min(f.max, +(v + f.step).toFixed(1)))}><Plus size={18} color={C.cream} /></RoundBtn>
        </div>
      </div>
      {big && <p style={{ color: C.creamDim, fontSize: 11, margin: "9px 0 0" }}>Позже — автоматически с часов или телефона</p>}
    </div>
  );
}

function TrendView({ history, fact }) {
  const rows = history.slice(-14);

  if (rows.length < 2) {
    return (
      <div style={{ padding: "12px 18px 0" }}>
        <div style={{ background: C.panel, borderRadius: 20, padding: "28px 20px", border: `1px solid ${C.line}`, textAlign: "center" }}>
          <p style={{ color: C.cream, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>График появится после второй записи</p>
          <p style={{ color: C.creamDim, fontSize: 13, margin: 0, lineHeight: 1.55 }}>
            Сохраняйте измерение каждый день — и здесь будет видно, как меняется ваше давление.
          </p>
        </div>
        <div style={{ marginTop: 12, background: `${C.mint}12`, border: `1px solid ${C.mintDim}44`, borderRadius: 16, padding: "15px 16px", display: "flex", gap: 12 }}>
          <div style={{ minWidth: 34, height: 34, borderRadius: 10, background: `${C.mint}22`, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }}>
            <Lightbulb size={18} color={C.mint} />
          </div>
          <div>
            <p style={{ color: C.mint, fontSize: 11.5, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>Полезно знать</p>
            <p style={{ color: C.cream, fontSize: 13, margin: 0, lineHeight: 1.55 }}>{fact}</p>
          </div>
        </div>
      </div>
    );
  }

  const max = Math.max(...rows.map((r) => r.sys)) + 6;
  const min = Math.min(...rows.map((r) => r.dia)) - 6;
  const H = 150, W = 340, step = W / (rows.length - 1);
  const y = (v) => H - ((v - min) / (max - min)) * H;
  const path = (key) => rows.map((r, i) => `${i === 0 ? "M" : "L"} ${i * step} ${y(r[key])}`).join(" ");

  return (
    <div style={{ padding: "12px 18px 0" }}>
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

      {/* Education woven in — one fact under the readings */}
      <div style={{ marginTop: 12, background: `${C.mint}12`, border: `1px solid ${C.mintDim}44`, borderRadius: 16, padding: "15px 16px", display: "flex", gap: 12 }}>
        <div style={{ minWidth: 34, height: 34, borderRadius: 10, background: `${C.mint}22`, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }}>
          <Lightbulb size={18} color={C.mint} />
        </div>
        <div>
          <p style={{ color: C.mint, fontSize: 11.5, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>Полезно знать</p>
          <p style={{ color: C.cream, fontSize: 13, margin: 0, lineHeight: 1.55 }}>{fact}</p>
        </div>
      </div>

      <p style={{ color: C.creamDim, fontSize: 12.5, margin: "22px 4px 11px", textTransform: "uppercase", letterSpacing: 0.6 }}>Недавние записи</p>
      {history.slice(-6).reverse().map((r, i) => {
        const d = new Date(r.date);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: C.panel, borderRadius: 14, marginBottom: 8, border: `1px solid ${C.line}` }}>
            <div>
              <span style={{ color: C.cream, fontSize: 15, fontWeight: 700 }}>{r.sys}/{r.dia}</span>
              <span style={{ color: C.creamDim, fontSize: 12, marginLeft: 8 }}>{d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
            </div>
            <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
              <MiniStat icon={Footprints} v={fmtNum(r.steps)} />
              <MiniStat icon={Moon} v={`${r.sleep}ч`} />
              <Pill size={15} color={r.taken ? C.mintDim : "#8A5A55"} />
            </div>
          </div>
        );
      })}
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
  // Не показываем «закономерность» по 2–3 дням — это вводило бы в заблуждение.
  if (daysLogged < 7) {
    const left = 7 - daysLogged;
    return (
      <div style={{ padding: "12px 18px 0" }}>
        <div style={{ background: `linear-gradient(160deg, ${C.panelSoft}, ${C.panel})`, borderRadius: 22, padding: "26px 20px", border: `1px solid ${C.mintDim}55`, textAlign: "center" }}>
          <Sparkles size={22} color={C.mint} style={{ marginBottom: 10 }} />
          <p style={{ fontFamily: "'Fraunces', serif", color: C.cream, fontSize: 21, fontWeight: 500, lineHeight: 1.35, margin: "0 0 8px" }}>
            Собираем вашу картину
          </p>
          <p style={{ color: C.creamDim, fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>
            Первые закономерности появятся примерно через {left} {left === 1 ? "день" : left < 5 ? "дня" : "дней"} записей.
            Чем дольше вы ведёте дневник, тем точнее картина.
          </p>
        </div>
      </div>
    );
  }

  const factorKey = insight.key;
  const pts = history.map((r) => ({ x: r[factorKey], y: r.sys }));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys) - 4, yMax = Math.max(...ys) + 4;
  const W = 320, H = 150;
  const px = (x) => ((x - xMin) / (xMax - xMin || 1)) * W;
  const py = (y) => H - ((y - yMin) / (yMax - yMin || 1)) * H;

  const strength = Math.abs(insight.r);
  const strengthLabel = strength > 0.5 ? "чёткая закономерность" : strength > 0.3 ? "первая закономерность" : "слабая связь";
  const mid = (xMin + xMax) / 2;
  const hi = ys.filter((_, i) => xs[i] >= mid);
  const lo = ys.filter((_, i) => xs[i] < mid);
  const avgHi = hi.length ? Math.round(hi.reduce((a, b) => a + b, 0) / hi.length) : 0;
  const avgLo = lo.length ? Math.round(lo.reduce((a, b) => a + b, 0) / lo.length) : 0;
  const gap = Math.abs(avgHi - avgLo);

  // Направление берём ИЗ ДАННЫХ, а не из ожиданий.
  const higherOnMore = avgHi > avgLo;           // больше фактора → давление выше?
  const dirWord = higherOnMore ? "выше" : "ниже";
  const dataSign = higherOnMore ? 1 : -1;
  // Неожиданно = данные разошлись с обычным медицинским ожиданием.
  const unexpected = insight.expected !== 0 && dataSign !== insight.expected;

  // Описания групп — нейтральные, без намёка на давление.
  const groups = {
    sleep: { more: "В дни, когда вы спали дольше", less: "в дни, когда вы спали меньше" },
    steps: { more: "В дни, когда вы больше ходили", less: "в дни, когда вы ходили меньше" },
    stress: { more: "В более напряжённые дни", less: "в спокойные дни" },
    salt: { more: "В дни с солёной едой", less: "в дни с лёгкой едой" },
  }[factorKey];

  // Подсказка следует за данными. При неожиданном направлении — не советуем
  // ничего менять, а предлагаем продолжить наблюдение и спросить врача.
  const nudgeExpected = {
    sleep: "Похоже, сон — один из ваших сильных рычагов. Попробуйте ложиться в одно и то же время.",
    steps: "Похоже, ходьба вам заметно помогает. Даже небольшая ежедневная прогулка — хороший шаг.",
    stress: "В напряжённые дни попробуйте несколько минут спокойствия перед сном.",
    salt: "Немного меньше соли несколько дней в неделю — маленький и выполнимый шаг.",
  }[factorKey];

  return (
    <div style={{ padding: "12px 18px 0" }}>
      <div style={{ background: `linear-gradient(160deg, ${C.panelSoft}, ${C.panel})`, borderRadius: 22, padding: "22px 20px", border: `1px solid ${C.mintDim}55` }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, color: C.mint, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7 }}>
          <Sparkles size={15} /> Ваша закономерность
        </span>
        <h2 style={{ fontFamily: "'Fraunces', serif", color: C.cream, fontSize: 23, fontWeight: 500, lineHeight: 1.3, margin: "12px 0 8px" }}>
          {groups.more} давление примерно <span style={{ color: C.coral }}>на {gap} единиц {dirWord}</span>, чем {groups.less}.
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
