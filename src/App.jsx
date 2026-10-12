import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlarmClock, Bell, BellOff, CalendarDays, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock3, LoaderCircle, Plus, Printer, Repeat2, ShieldCheck,
  Sparkles, Trash2, X,
} from "lucide-react";

const firebaseApi = () =>
  Promise.all([import("./firebase"), import("firebase/auth"), import("firebase/firestore")])
    .then(([app, auth, store]) => ({ ...app, ...auth, ...store }));
const KEY = "pastillas:records:v1", DEL = "pastillas:deleted:v1", OWNER = "pastillas:owner";
const COLORS = ["mint", "coral", "blue", "lavender", "sun", "teal"];
const dayKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = () => dayKey(new Date());
const id = () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const hm = (stamp) => stamp ? new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(stamp)) : "";
const atTime = (day, time) => time ? new Date(day + "T" + time + ":00").getTime() : null;
const actualTimeFor = (day) => atTime(day, hm(Date.now()));
const dateLabel = (day) => new Intl.DateTimeFormat("es-BO", { weekday: "long", day: "numeric", month: "long" }).format(new Date(day + "T12:00:00"));
const shortDay = (day) => new Intl.DateTimeFormat("es-BO", { weekday: "short" }).format(new Date(day + "T12:00:00")).replace(".", "");
const monthTitle = (date) => new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric" }).format(date);
const recordsKey = (uid) => KEY + ":" + uid, deletedKey = (uid) => DEL + ":" + uid;
const plansKey = (uid) => "pastillas:plans:v1:" + uid, prefsKey = (uid) => "pastillas:settings:v1:" + uid;
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }
function readPlans(uid) { const v = readJson(plansKey(uid), []); return Array.isArray(v) ? v : []; }
function readReminders(uid) { const v = readJson(prefsKey(uid), {}); return typeof v.remindersEnabled === "boolean" ? v.remindersEnabled : true; }
function writePlans(uid, plans) { try { localStorage.setItem(plansKey(uid), JSON.stringify(plans)); } catch {} }
function writeReminders(uid, value) { try { localStorage.setItem(prefsKey(uid), JSON.stringify({ remindersEnabled: value })); } catch {} }
function mergePlans(local, remote) {
  const map = new Map(local.map((x) => [x.id, x]));
  remote.forEach((x) => { const old = map.get(x.id); if (!old || (Number(x.updatedAt) || 0) >= (Number(old.updatedAt) || 0)) map.set(x.id, x); });
  return [...map.values()];
}
function readDeleted(uid, owner) {
  const source = owner === uid ? uid : owner?.startsWith("local-") ? owner : !owner ? "legacy" : null;
  try { return new Set(JSON.parse(localStorage.getItem(source === "legacy" ? DEL : source ? deletedKey(source) : "") || "[]")); } catch { return new Set(); }
}
function writeDeleted(ids, uid) { try { localStorage.setItem(deletedKey(uid), JSON.stringify([...ids])); } catch {} }
function readRecords(uid, owner) {
  let items = [];
  const source = owner === uid ? uid : owner?.startsWith("local-") ? owner : null;
  try { items = JSON.parse(localStorage.getItem(source ? recordsKey(source) : !owner ? KEY : "") || "[]"); } catch {}
  if (!Array.isArray(items)) items = [];
  if (!owner || owner === uid || owner.startsWith("local-")) {
    const ids = new Set(items.map((x) => x.id));
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /^\d{4}-\d{2}-\d{2}$/.test(key) && localStorage.getItem(key) === "tomada" && !ids.has("legacy-" + key))
        items.push({ id: "legacy-" + key, medicine: "Pastilla sin especificar", date: key, status: "taken", takenAt: null, plannedTime: null, legacy: true, updatedAt: 0 });
    }
  }
  return items;
}
function persist(items, uid) { try { localStorage.setItem(recordsKey(uid), JSON.stringify(items.filter((x) => !x.legacy))); } catch {} }
function mergeRecords(local, remote, deleted) {
  const map = new Map(local.map((x) => [x.id, x]));
  remote.forEach((x) => { const old = map.get(x.id); if (!old || (Number(x.updatedAt) || 0) > (Number(old.updatedAt) || 0)) map.set(x.id, { ...x, legacy: !!x.legacy }); });
  return [...map.values()].filter((x) => !deleted.has(x.id));
}
function mark(name) {
  const value = norm(name); let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return { tone: COLORS[Math.abs(hash) % COLORS.length], shape: /capsula|capsule|gelcap/.test(value) ? "cap" : /pastilla|tableta|comprimido|tablet/.test(value) ? "tab" : Math.abs(hash >> 3) % 2 ? "cap" : "tab" };
}
function Med({ name, small = false }) {
  const m = mark(name);
  return <span className={"medicine-mark " + m.tone + (small ? " small" : "")} aria-hidden="true">
    {m.shape === "cap" ? <svg viewBox="0 0 48 48"><g transform="rotate(-38 24 24)"><rect x="8" y="15" width="32" height="18" rx="9" fill="currentColor" /><path d="M24 15v18" stroke="white" strokeOpacity=".8" strokeWidth="2" /><path d="M24 16h7a8 8 0 0 1 0 16h-7z" fill="white" fillOpacity=".55" /></g></svg> : <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="currentColor" /><path d="M14 24h20" stroke="white" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" /><circle cx="18" cy="18" r="2" fill="white" fillOpacity=".5" /></svg>}
  </span>;
}
function Modal({ title, sub, onClose, children }) {
  useEffect(() => { const f = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="modal-card">
      <div className="modal-heading"><div><p className="eyebrow">{sub}</p><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      {children}
    </section>
  </div>;
}
function QuickLogModal({ date, suggestions, onClose, onSave }) {
  const [medicine, setMedicine] = useState(""), [error, setError] = useState("");
  function submit(e) {
    e.preventDefault(); if (!medicine.trim()) { setError("Escribe el nombre del medicamento."); return; }
    onSave({ medicine: medicine.trim(), date, plannedTime: null, status: "taken", takenAt: actualTimeFor(date), legacy: false });
  }
  return <Modal title="Registrar una toma" sub="REGISTRO RÁPIDO" onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <label className="field-label">¿Qué medicamento tomaste?<input autoFocus list="medicine-suggestions" value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder="Ej. Cortypiren" maxLength={70} required /></label>
      <datalist id="medicine-suggestions">{suggestions.map((x) => <option key={x} value={x} />)}</datalist>
      {medicine.trim() && <div className="medicine-preview"><Med name={medicine} /><span>Se guardará como <b>{medicine}</b>.</span></div>}
      <div className="auto-time-note"><Clock3 size={16} /><span>Se registrará automáticamente la hora actual: <b>{hm(Date.now())}</b></span></div>
      {date !== today() && <p className="modal-copy compact-copy">Se guardará en {dateLabel(date)} usando la hora actual.</p>}
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button full-button"><CheckCircle2 size={17} />Registrar como tomada</button>
    </form>
  </Modal>;
}
function PlanModal({ date, suggestions, onClose, onSave }) {
  const [medicine, setMedicine] = useState(""), [startDate, setStartDate] = useState(date), [time, setTime] = useState("09:00");
  const [interval, setInterval] = useState("1"), [intervalUnit, setIntervalUnit] = useState("days");
  const [duration, setDuration] = useState("1"), [durationUnit, setDurationUnit] = useState("weeks"), [indefinite, setIndefinite] = useState(false), [error, setError] = useState("");
  function submit(e) {
    e.preventDefault(); const repeat = Number(interval), length = Number(duration);
    if (!medicine.trim()) { setError("Escribe el nombre del medicamento."); return; }
    if (!repeat || repeat < 1 || repeat > 365) { setError("El intervalo debe ser de 1 a 365."); return; }
    if (!indefinite && (!length || length < 1 || length > 365)) { setError("La duración debe ser de 1 a 365."); return; }
    const now = Date.now();
    onSave({ id: id(), medicine: medicine.trim(), startDate, time, interval: repeat, intervalUnit, duration: indefinite ? 0 : length, durationUnit, active: true, createdAt: now, updatedAt: now });
  }
  return <Modal title="Programar medicamento" sub="TRATAMIENTO RECETADO" onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <label className="field-label">Nombre del medicamento<input autoFocus list="plan-medicines" value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder="Ej. Cortypiren" maxLength={70} required /></label>
      <datalist id="plan-medicines">{suggestions.map((x) => <option key={x} value={x} />)}</datalist>
      <div className="form-two-columns">
        <label className="field-label">Empieza el<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label>
        <label className="field-label">Hora prevista<input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></label>
      </div>
      <div className="schedule-builder"><Repeat2 size={16} /><span>Se repetirá cada</span><input className="small-number-input" aria-label="Intervalo" type="number" min="1" max="365" value={interval} onChange={(e) => setInterval(e.target.value)} /><select aria-label="Unidad del intervalo" value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value)}><option value="days">días</option><option value="weeks">semanas</option></select></div>
      <label className="field-label">Duración del tratamiento<select value={indefinite ? "forever" : "limited"} onChange={(e) => setIndefinite(e.target.value === "forever")}><option value="limited">Por un tiempo definido</option><option value="forever">Sin fecha de finalización</option></select></label>
      {!indefinite && <div className="schedule-builder duration-builder"><span>Durante</span><input className="small-number-input" aria-label="Duración" type="number" min="1" max="365" value={duration} onChange={(e) => setDuration(e.target.value)} /><select aria-label="Unidad de duración" value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)}><option value="days">días</option><option value="weeks">semanas</option><option value="months">meses</option></select></div>}
      <p className="schedule-example">Ejemplo: cada 2 días durante 1 semana genera tomas el día 1, 3, 5 y 7.</p>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button full-button"><CalendarDays size={17} />Guardar tratamiento</button>
    </form>
  </Modal>;
}
function addDays(day, amount) { const date = new Date(day + "T12:00:00"); date.setDate(date.getDate() + amount); return dayKey(date); }
function addMonths(day, amount) {
  const date = new Date(day + "T12:00:00"), d = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + amount);
  date.setDate(Math.min(d, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())); return dayKey(date);
}
function daysBetween(first, second) {
  const a = new Date(first + "T12:00:00"), b = new Date(second + "T12:00:00");
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}
function isDue(plan, date) {
  if (!plan.active || date < plan.startDate || !plan.time) return false;
  const elapsed = daysBetween(plan.startDate, date), step = Number(plan.interval) * (plan.intervalUnit === "weeks" ? 7 : 1);
  if (elapsed < 0 || !step || elapsed % step) return false;
  if (!Number(plan.duration)) return true;
  if (plan.durationUnit === "months") return date < addMonths(plan.startDate, Number(plan.duration));
  const length = Number(plan.duration) * (plan.durationUnit === "weeks" ? 7 : 1);
  return elapsed < length;
}
function rangeFor(day, view) {
  if (view === "year") return [day.slice(0, 4) + "-01-01", day.slice(0, 4) + "-12-31"];
  if (view === "month") return [day.slice(0, 7) + "-01", dayKey(new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0))];
  const weekday = (new Date(day + "T12:00:00").getDay() + 6) % 7, start = addDays(day, -weekday);
  return [start, addDays(start, 6)];
}
function MonthGrid({ year, month, selected, countFor, onSelect, compact = false }) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7, total = new Date(year, month + 1, 0).getDate();
  const days = [...Array(offset).fill(0), ...Array.from({ length: total }, (_, i) => i + 1)];
  return <div className={"calendar-grid" + (compact ? " mini-calendar-grid" : "")}>
    {["L", "M", "X", "J", "V", "S", "D"].map((x, i) => <span className="calendar-weekday" key={"w" + i}>{x}</span>)}
    {days.map((n, i) => {
      if (!n) return <span className="calendar-blank" key={"b" + i} />;
      const key = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(n).padStart(2, "0"), count = countFor(key);
      return <button key={key} className={"calendar-day" + (selected === key ? " selected" : "") + (today() === key ? " is-today" : "") + (compact ? " compact-day" : "")} onClick={() => onSelect(key)} aria-label={dateLabel(key) + (count ? ", " + count + " registro(s)" : "")}><span>{n}</span>{count > 0 && <i />}</button>;
    })}
  </div>;
}
function CalendarPanel({ day, view, records, plans, onDay, onView, onShift }) {
  const date = new Date(day + "T12:00:00"), [start, end] = rangeFor(day, view);
  const countFor = (key) => {
    const existing = records.filter((x) => x.date === key), covered = new Set(existing.map((x) => x.planId).filter(Boolean));
    return existing.length + plans.filter((p) => isDue(p, key) && !covered.has(p.id)).length;
  };
  const title = view === "year" ? day.slice(0, 4) : view === "week" ? start.slice(8) + " – " + end.slice(8) + " · " + monthTitle(date) : monthTitle(date);
  return <section className="calendar-panel" id="calendar-top" aria-label="Calendario de medicamentos">
    <div className="calendar-toolbar"><div className="calendar-navigation"><button className="icon-button" onClick={() => onShift(-1)} aria-label="Periodo anterior"><ChevronLeft /></button><h2>{title}</h2><button className="icon-button" onClick={() => onShift(1)} aria-label="Periodo siguiente"><ChevronRight /></button><button className="today-button" onClick={() => onDay(today())}>Hoy</button></div>
      <div className="calendar-mode" role="group" aria-label="Vista del calendario">{[["month", "Mes"], ["week", "Semana"], ["year", "Año"]].map(([v, label]) => <button key={v} className={view === v ? "active" : ""} onClick={() => onView(v)}>{label}</button>)}</div>
    </div>
    {view === "month" && <MonthGrid year={date.getFullYear()} month={date.getMonth()} selected={day} countFor={countFor} onSelect={onDay} />}
    {view === "week" && <div className="week-calendar">{Array.from({ length: 7 }, (_, i) => {
      const key = addDays(start, i), count = countFor(key);
      return <button key={key} className={"week-day-card" + (key === day ? " selected" : "") + (key === today() ? " is-today" : "")} onClick={() => onDay(key)}><span>{shortDay(key)}</span><b>{Number(key.slice(-2))}</b><small>{count ? count + " toma(s)" : "—"}</small>{count > 0 && <i />}</button>;
    })}</div>}
    {view === "year" && <div className="year-calendar">{Array.from({ length: 12 }, (_, month) => <article className="year-month" key={month}><h3>{new Intl.DateTimeFormat("es-BO", { month: "long" }).format(new Date(date.getFullYear(), month, 1))}</h3><MonthGrid year={date.getFullYear()} month={month} selected={day} countFor={countFor} onSelect={onDay} compact /></article>)}</div>}
    <div className="calendar-legend"><span><i /> Día con toma programada o registrada</span><span>Selecciona una fecha para ver el detalle</span></div>
  </section>;
}
function periodSummary(day, view, records, plans) {
  const [start, end] = rangeFor(day, view), taken = records.filter((x) => x.status === "taken" && x.date >= start && x.date <= end), pending = records.filter((x) => x.status !== "taken" && x.date >= start && x.date <= end);
  let scheduled = 0, cursor = start;
  while (cursor <= end) {
    plans.forEach((p) => { if (isDue(p, cursor) && !records.some((x) => x.planId === p.id && x.date === cursor)) scheduled++; });
    cursor = addDays(cursor, 1);
  }
  return { taken: taken.length, pending: pending.length + scheduled, days: new Set(taken.map((x) => x.date)).size, start, end };
}
function DoseCard({ dose, onTake, onDelete }) {
  const delta = dose.plannedTime && dose.takenAt ? Math.round((dose.takenAt - atTime(dose.date, dose.plannedTime)) / 60000) : null;
  const diff = delta === null ? null : Math.abs(delta) <= 1 ? "A tiempo" : Math.abs(delta) + " min " + (delta < 0 ? "antes" : "tarde");
  return <article className={"dose-card" + (dose.status === "taken" ? " dose-taken" : "")}><Med name={dose.medicine} /><div className="dose-content"><div className="dose-title-row"><h3>{dose.medicine}</h3>{dose.legacy && <span className="legacy-pill">Histórico</span>}{dose.isVirtual && <span className="scheduled-pill">Programada</span>}</div><div className="dose-times"><span><AlarmClock size={14} />{dose.plannedTime ? "Prevista " + dose.plannedTime : "Hora no registrada"}</span>{dose.status === "taken" && <span className="actual-time"><CheckCircle2 size={14} />{dose.takenAt ? "Tomada " + hm(dose.takenAt) : "Tomada"}</span>}</div>{diff && <p className={"time-delta" + (diff === "A tiempo" ? " on-time" : "")}>{diff}</p>}</div>
    {!dose.legacy && <div className="dose-actions">{dose.status !== "taken" && <button className="take-button" onClick={() => onTake(dose)} aria-label={"Registrar " + dose.medicine + " como tomada ahora"}><Check size={16} /><span>Tomada ahora</span></button>}{!dose.isVirtual && <button className="icon-button delete-button" onClick={() => onDelete(dose)} aria-label={"Eliminar " + dose.medicine}><Trash2 size={16} /></button>}</div>}
  </article>;
}
function App() {
  const [records, setRecords] = useState([]), [plans, setPlans] = useState([]), [uid, setUid] = useState("");
  const [cloud, setCloud] = useState(false), [authError, setAuthError] = useState(false), [sync, setSync] = useState("connecting"), [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(new Set()), [deletes, setDeletes] = useState(new Set()), [retry, setRetry] = useState(0);
  const [name, setName] = useState(""), [day, setDay] = useState(today), [view, setView] = useState("month"), [modal, setModal] = useState(""), [selected, setSelected] = useState(null), [reminders, setReminders] = useState(true);
  const startupShown = useRef(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const f = await firebaseApi(); await f.setPersistence(f.auth, f.browserLocalPersistence);
        const user = f.auth.currentUser || (await f.signInAnonymously(f.auth)).user;
        if (!live) return;
        const previous = localStorage.getItem(OWNER), local = readRecords(user.uid, previous), oldName = previous?.startsWith("local-") ? localStorage.getItem("pastillas:name:" + previous) : "";
        if (oldName && !localStorage.getItem("pastillas:name:" + user.uid)) localStorage.setItem("pastillas:name:" + user.uid, oldName);
        setRecords(local); persist(local, user.uid); setPlans(readPlans(user.uid)); setReminders(readReminders(user.uid)); setDeletes(readDeleted(user.uid, previous));
        localStorage.setItem(OWNER, user.uid); setUid(user.uid); setCloud(true); setSync("syncing"); setName(localStorage.getItem("pastillas:name:" + user.uid) || "");
      } catch {
        if (!live) return;
        const owner = localStorage.getItem(OWNER); let key = owner || localStorage.getItem("pastillas:offline-user");
        if (!key) { key = "local-" + id(); localStorage.setItem("pastillas:offline-user", key); }
        const local = readRecords(key, owner);
        setRecords(local); persist(local, key); setPlans(readPlans(key)); setReminders(readReminders(key)); setDeletes(readDeleted(key, owner));
        localStorage.setItem(OWNER, key); setUid(key); setName(localStorage.getItem("pastillas:name:" + key) || ""); setAuthError(true); setSync("local"); setLoaded(true);
      }
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!uid || !cloud) return; let live = true;
    (async () => {
      try {
        const f = await firebaseApi(), collection = f.collection(f.db, "usuarios", uid, "registros");
        const [profile, snapshot] = await Promise.all([f.getDoc(f.doc(f.db, "usuarios", uid)), f.getDocs(collection)]);
        if (!live) return;
        const remote = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), known = new Set(remote.map((x) => x.id)), all = mergeRecords(records, remote, deletes), data = profile.exists() ? profile.data() : {};
        setRecords(all); persist(all, uid); setDirty((old) => { const next = new Set(old); all.forEach((x) => { if (!known.has(x.id)) next.add(x.id); }); return next; });
        const cached = localStorage.getItem("pastillas:name:" + uid) || ""; setName(data.displayName || cached);
        if (data.displayName || cached) localStorage.setItem("pastillas:name:" + uid, data.displayName || cached);
        const combined = mergePlans(readPlans(uid), Array.isArray(data.plans) ? data.plans : []); setPlans(combined); writePlans(uid, combined);
        const reminderValue = typeof data.remindersEnabled === "boolean" ? data.remindersEnabled : readReminders(uid); setReminders(reminderValue); writeReminders(uid, reminderValue);
        setLoaded(true); setSync("online");
      } catch { if (live) { setLoaded(true); setSync("local"); } }
    })();
    return () => { live = false; };
  }, [uid, cloud, retry]);
  useEffect(() => { const retryNow = () => setRetry((x) => x + 1); window.addEventListener("online", retryNow); return () => window.removeEventListener("online", retryNow); }, []);
  useEffect(() => {
    if (!uid || !cloud || !loaded || (!dirty.size && !deletes.size)) return; let live = true;
    const timer = setTimeout(async () => {
      const updates = new Set(dirty), removed = new Set(deletes); setSync("syncing");
      try {
        const f = await firebaseApi();
        for (let i = 0; i < updates.size; i += 400) {
          const batch = f.writeBatch(f.db);
          [...updates].slice(i, i + 400).forEach((key) => { const item = records.find((x) => x.id === key); if (item) batch.set(f.doc(f.db, "usuarios", uid, "registros", key), item); });
          await batch.commit();
        }
        for (const key of removed) await f.deleteDoc(f.doc(f.db, "usuarios", uid, "registros", key));
        if (!live) return;
        setDirty((old) => new Set([...old].filter((x) => !updates.has(x))));
        setDeletes((old) => { const next = new Set([...old].filter((x) => !removed.has(x))); writeDeleted(next, uid); return next; }); setSync("online");
      } catch { if (live) setSync("local"); }
    }, 600);
    return () => { live = false; clearTimeout(timer); };
  }, [uid, cloud, loaded, dirty, deletes, records, retry]);
  useEffect(() => {
    if (!uid || !loaded) return;
    writePlans(uid, plans); writeReminders(uid, reminders);
    if (!cloud) return;
    const timer = setTimeout(async () => {
      try { const f = await firebaseApi(); await f.setDoc(f.doc(f.db, "usuarios", uid), { plans, remindersEnabled: reminders, updatedAt: Date.now() }, { merge: true }); }
      catch { setSync("local"); }
    }, 650);
    return () => clearTimeout(timer);
  }, [uid, loaded, cloud, plans, reminders]);
  const names = useMemo(() => [...new Set(records.filter((x) => !x.legacy).map((x) => x.medicine).concat(plans.map((x) => x.medicine)))].sort((a, b) => a.localeCompare(b, "es")), [records, plans]);
  const dayDoses = useMemo(() => {
    const saved = records.filter((x) => x.date === day), covered = new Set(saved.map((x) => x.planId).filter(Boolean));
    const virtual = plans.filter((p) => isDue(p, day) && !covered.has(p.id)).map((p) => ({ id: "due-" + p.id + "-" + day, planId: p.id, medicine: p.medicine, date: day, plannedTime: p.time, status: "planned", takenAt: null, legacy: false, isVirtual: true }));
    return [...saved, ...virtual].sort((a, b) => (a.plannedTime || "99:99").localeCompare(b.plannedTime || "99:99"));
  }, [records, plans, day]);
  const summary = useMemo(() => periodSummary(day, view, records, plans), [day, view, records, plans]);
  const reportRecords = useMemo(() => records
    .filter((x) => x.status === "taken" && x.date >= summary.start && x.date <= summary.end)
    .sort((a, b) => (b.date + (b.takenAt || 0)).localeCompare(a.date + (a.takenAt || 0))), [records, summary.start, summary.end]);
  const activePlans = plans.filter((p) => p.active), dueToday = activePlans.filter((p) => isDue(p, today()));
  const remainingToday = dueToday.filter((p) => !records.some((x) => x.planId === p.id && x.date === today() && x.status === "taken"));
  useEffect(() => { if (loaded && !startupShown.current) { startupShown.current = true; if (reminders && activePlans.length) setModal("reminder"); } }, [loaded, reminders, activePlans.length]);
  useEffect(() => {
    if (!reminders || !plans.length || !("Notification" in window) || Notification.permission !== "granted") return;
    const timers = [];
    plans.filter((p) => isDue(p, today())).forEach((p) => {
      const taken = records.some((x) => x.planId === p.id && x.date === today() && x.status === "taken"), due = atTime(today(), p.time);
      if (!taken && due > Date.now()) timers.push(setTimeout(async () => {
        try { const reg = await navigator.serviceWorker?.ready; if (reg?.showNotification) await reg.showNotification("Hora de tu medicamento", { body: p.medicine + " · " + p.time, icon: "./icons/icon-192.png", tag: p.id + "-" + today() }); else new Notification("Hora de tu medicamento", { body: p.medicine + " · " + p.time }); } catch {}
      }, due - Date.now()));
    });
    return () => timers.forEach(clearTimeout);
  }, [plans, records, reminders]);
  function saveRecord(data) { const item = { id: id(), ...data, legacy: false, updatedAt: Date.now() }, next = [...records, item]; setRecords(next); persist(next, uid); setDirty((old) => new Set(old).add(item.id)); setModal(""); }
  function takeDose(dose) {
    const item = { ...(dose.isVirtual ? {} : dose), id: dose.isVirtual ? id() : dose.id, planId: dose.planId || null, medicine: dose.medicine, date: dose.date, plannedTime: dose.plannedTime || null, status: "taken", takenAt: actualTimeFor(dose.date), legacy: false, updatedAt: Date.now() };
    const next = dose.isVirtual ? [...records, item] : records.map((x) => x.id === item.id ? item : x);
    setRecords(next); persist(next, uid); setDirty((old) => new Set(old).add(item.id));
  }
  function removeRecord(record) {
    const next = records.filter((x) => x.id !== record.id); setRecords(next); persist(next, uid);
    if (!record.legacy) { setDeletes((old) => { const n = new Set(old).add(record.id); writeDeleted(n, uid); return n; }); setDirty((old) => { const n = new Set(old); n.delete(record.id); return n; }); }
    setSelected(null); setModal("");
  }
  function savePlan(plan) { setPlans((old) => [...old, plan]); setModal(""); }
  function togglePlan(plan) { setPlans((old) => old.map((x) => x.id === plan.id ? { ...x, active: !x.active, updatedAt: Date.now() } : x)); }
  function saveProfile(event) {
    event.preventDefault(); const value = new FormData(event.currentTarget).get("displayName")?.toString().trim(); if (!value) return;
    setName(value); localStorage.setItem("pastillas:name:" + uid, value);
    if (cloud) firebaseApi().then((f) => f.setDoc(f.doc(f.db, "usuarios", uid), { displayName: value, updatedAt: Date.now() }, { merge: true })).then(() => setSync("online")).catch(() => setSync("local"));
    setModal("");
  }
  async function enableNotifications() { if ("Notification" in window && await Notification.requestPermission() === "granted") setModal(""); }
  function shift(direction) { if (view === "year") setDay((Number(day.slice(0, 4)) + direction) + day.slice(4)); else if (view === "week") setDay(addDays(day, direction * 7)); else setDay(addMonths(day, direction)); }
  const initials = name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "T";
  const picked = dateLabel(day), permission = "Notification" in window ? Notification.permission : "unsupported";
  const year = day.slice(0, 4), yearlyCount = records.filter((x) => x.status === "taken" && x.date.startsWith(year)).length;
  return <div className="app-shell">
    <aside className="desktop-sidebar"><a className="brand" href="./"><span className="brand-icon"><Activity size={21} /></span><span>pastillas<span className="brand-dot">.</span><small>MI REGISTRO PERSONAL</small></span></a>
      <div className="side-label">ESPACIO PERSONAL</div>
      <button className="side-link active" onClick={() => { setDay(today()); setView("month"); }}><CalendarDays size={18} />Calendario<span className="side-live" /></button>
      <button className="side-link" onClick={() => document.getElementById("treatments")?.scrollIntoView({ behavior: "smooth" })}><Repeat2 size={18} />Tratamientos</button>
      <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={18} /><div><b>Tu espacio privado</b><span>Solo tú ves tus registros.</span></div></div>
        <button className="profile-button" onClick={() => setModal("profile")}><span className="avatar">{initials}</span><span className="profile-copy"><b>{name || "Tu perfil"}</b><small>Perfil personal</small></span><ChevronRight size={17} /></button>
      </div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="mobile-brand"><span className="brand-icon"><Activity size={19} /></span><b>pastillas<span className="brand-dot">.</span></b></div>
      <div className="sync-indicator"><span className={"sync-dot " + (sync === "online" ? "is-online" : sync === "syncing" || sync === "connecting" ? "is-syncing" : "")}>{sync === "syncing" || sync === "connecting" ? <LoaderCircle size={12} /> : null}</span>{sync === "online" ? "Guardado en la nube" : sync === "local" ? "Guardado en este dispositivo" : "Sincronizando"}</div>
      <button className="avatar top-avatar" onClick={() => setModal("profile")} aria-label="Perfil">{initials}</button>
    </header>
      <div className="content-wrap calendar-content">
        <section className="welcome-row calendar-welcome"><div><p className="eyebrow greeting">TU HISTORIAL DE MEDICAMENTOS</p><h1>Calendario <span className="wave">✦</span></h1><p className="date-line">{day === today() ? "Hoy · " : ""}{picked}</p></div><button className="date-picker-button" onClick={() => setDay(today())}><CalendarDays size={17} /><span>Ir a hoy</span></button></section>
        <section className="period-summary"><div className="period-summary-main"><span className="summary-icon"><Sparkles size={17} /></span><div><p className="summary-label">{view === "month" ? "RESUMEN DEL MES" : view === "week" ? "RESUMEN DE LA SEMANA" : "RESUMEN DEL AÑO"}</p><h2>{summary.taken} <span>tomas registradas</span></h2><p>{summary.days} días con registro · {summary.pending} pendientes programadas</p></div></div><div className="year-total"><b>{yearlyCount}</b><span>tomas este año</span></div></section>
        <CalendarPanel day={day} view={view} records={records} plans={activePlans} onDay={setDay} onView={setView} onShift={shift} />
        <section className="doctor-report">
          <div className="doctor-report-heading">
            <div><p className="eyebrow">SEGUIMIENTO</p><h2>Consumo del periodo <span>{reportRecords.length}</span></h2><p>Registro de tomas para revisar o compartir con tu médico.</p></div>
            <button className="secondary-button print-button" onClick={() => window.print()}><Printer size={16} />Imprimir / PDF</button>
          </div>
          {reportRecords.length ? <div className="report-list">{reportRecords.map((record) => <div className="report-row" key={record.id}><span className="report-date">{new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short" }).format(new Date(record.date + "T12:00:00"))}</span><Med name={record.medicine} small /><b>{record.medicine}</b><span className="report-time">{record.takenAt ? hm(record.takenAt) : "Hora no registrada"}</span></div>)}</div> : <p className="report-empty">Todavía no hay tomas registradas en este periodo.</p>}
        </section>
        <section className="selected-day-section"><div className="selected-day-heading"><div><p className="eyebrow">DETALLE DEL DÍA</p><h2>{picked}</h2><p>Las tomas nuevas guardan automáticamente la hora actual.</p></div><button className="primary-button quick-log-button" onClick={() => setModal("quick-log")}><Plus size={18} />Registrar toma</button></div>
          {dayDoses.length ? <div className="dose-list">{dayDoses.map((dose) => <DoseCard key={dose.id} dose={dose} onTake={takeDose} onDelete={(record) => { setSelected(record); setModal("delete"); }} />)}</div> : <div className="calendar-empty"><div className="calendar-empty-icon"><CalendarDays size={21} /></div><div><b>No hay tomas en esta fecha</b><span>Si olvidaste registrarla, puedes añadirla ahora.</span></div></div>}
        </section>
        <section className="treatments-section" id="treatments"><div className="section-heading"><div><h2>Tratamientos programados</h2><p>Configura recetas y repeticiones para verlas en el calendario.</p></div><button className="secondary-button add-plan-button" onClick={() => setModal("plan")}><Plus size={16} />Nuevo tratamiento</button></div>
          {activePlans.length ? <div className="treatment-list">{plans.map((p) => <article className={"treatment-card" + (!p.active ? " treatment-paused" : "")} key={p.id}><Med name={p.medicine} /><div className="treatment-copy"><b>{p.medicine}</b><span>{p.active ? "Cada " + p.interval + " " + (p.intervalUnit === "weeks" ? "semana(s)" : "día(s)") + " · " + p.time : "Pausado"}</span></div><button className={"switch-button" + (p.active ? " is-on" : "")} role="switch" aria-checked={p.active} aria-label={(p.active ? "Pausar " : "Activar ") + p.medicine} onClick={() => togglePlan(p)}><span /></button></article>)}</div> : <div className="no-treatments"><span className="no-treatment-icon"><Repeat2 size={18} /></span><div><b>Aún no tienes tratamientos</b><span>Programa uno para que sus tomas aparezcan en las fechas indicadas.</span></div><button className="text-button" onClick={() => setModal("plan")}>Programar</button></div>}
          <div className="notification-caption"><Bell size={14} />{reminders ? "Los recordatorios al abrir están activados." : "Los recordatorios están desactivados."}</div>
        </section>
        <footer className="footnote"><ShieldCheck size={15} />Un registro personal para revisar tus tomas y compartirlo con tu médico.</footer>
      </div>
    </main>
    <nav className="mobile-nav"><button className="mobile-nav-link active" onClick={() => { setDay(today()); setView("month"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><CalendarDays size={19} /><span>Calendario</span></button><button className="mobile-add" onClick={() => setModal("quick-log")} aria-label="Registrar toma"><Plus size={22} /></button><button className="mobile-nav-link" onClick={() => document.getElementById("treatments")?.scrollIntoView({ behavior: "smooth" })}><Repeat2 size={19} /><span>Tratamientos</span></button></nav>
    {modal === "quick-log" && <QuickLogModal date={day} suggestions={names} onClose={() => setModal("")} onSave={saveRecord} />}
    {modal === "plan" && <PlanModal date={day} suggestions={names} onClose={() => setModal("")} onSave={savePlan} />}
    {modal === "delete" && selected && <Modal title="¿Eliminar este registro?" sub="CONFIRMAR CAMBIO" onClose={() => { setModal(""); setSelected(null); }}><div className="confirm-med"><Med name={selected.medicine} /><div><b>{selected.medicine}</b><span>{dateLabel(selected.date)}{selected.plannedTime ? " · " + selected.plannedTime : ""}</span></div></div><p className="modal-copy">Se quitará del historial de este dispositivo y de tu espacio sincronizado.</p><div className="modal-actions"><button className="secondary-button" onClick={() => { setModal(""); setSelected(null); }}>Conservar</button><button className="danger-button" onClick={() => removeRecord(selected)}><Trash2 size={16} />Eliminar</button></div></Modal>}
    {modal === "profile" && <Modal title="Tu perfil y avisos" sub="ESPACIO PERSONAL" onClose={() => setModal("")}><div className="profile-identity"><span className="avatar avatar-large">{initials}</span><div><b>{name || "Tu perfil"}</b><span>{cloud ? "ID de usuario · " + uid.slice(0, 7) : "Guardado local en este navegador"}</span></div></div><form className="form-stack" onSubmit={saveProfile}><label className="field-label">¿Cómo te llamamos?<input name="displayName" defaultValue={name} placeholder="Tu nombre" maxLength={40} required /></label><p className="privacy-note"><ShieldCheck size={15} />El nombre solo identifica tu perfil. Tus datos se separan por identidad anónima.</p>{authError && <p className="form-error">Firebase no está disponible. Puedes seguir registrando en este dispositivo.</p>}<button className="primary-button full-button">{name ? "Guardar nombre" : "Continuar"}<ChevronRight size={17} /></button></form>
      <div className="settings-divider" /><div className="settings-line"><div><b>Aviso al abrir la app</b><span>Mostrar tus próximas tomas cada vez que ingreses.</span></div><button className={"switch-button" + (reminders ? " is-on" : "")} role="switch" aria-checked={reminders} onClick={() => setReminders((v) => !v)} aria-label="Alternar aviso al abrir"><span /></button></div>
      <div className="browser-notification-row"><div className="browser-notification-icon">{permission === "granted" ? <Bell size={17} /> : <BellOff size={17} />}</div><div><b>{permission === "granted" ? "Avisos del navegador activos" : permission === "denied" ? "Avisos bloqueados por el navegador" : "Avisos del navegador"}</b><span>Se muestran mientras la app esté abierta.</span></div>{permission !== "granted" && permission !== "denied" && <button className="text-button" onClick={enableNotifications}>Activar</button>}</div>
    </Modal>}
    {modal === "reminder" && reminders && activePlans.length > 0 && <Modal title={remainingToday.length ? "Tus medicamentos de hoy" : "Tus tratamientos activos"} sub="RECORDATORIO PERSONAL" onClose={() => setModal("")}><div className="reminder-modal-intro"><span className="reminder-bell"><Bell size={19} /></span><p>{remainingToday.length ? "Tienes " + remainingToday.length + (remainingToday.length === 1 ? " toma programada" : " tomas programadas") + " para hoy." : "Revisa tus tratamientos y sus próximas fechas."}</p></div><div className="reminder-dose-list">{(remainingToday.length ? remainingToday : activePlans.slice(0, 3)).map((p) => <div className="reminder-dose" key={p.id}><Med name={p.medicine} small /><span><b>{p.medicine}</b><small>{isDue(p, today()) ? "Hoy · " + p.time : "Cada " + p.interval + " " + (p.intervalUnit === "weeks" ? "semana(s)" : "día(s)") + " · " + p.time}</small></span></div>)}</div><div className="modal-actions reminder-actions"><button className="text-button" onClick={() => { setReminders(false); setModal(""); }}>Desactivar avisos</button><button className="primary-button" onClick={() => { setModal(""); document.getElementById("calendar-top")?.scrollIntoView({ behavior: "smooth" }); }}>Ver calendario</button></div></Modal>}
    {!name && loaded && modal !== "profile" && modal !== "reminder" && <Modal title="Tu registro, a tu manera" sub="BIENVENIDO A PASTILLAS" onClose={() => setModal("profile")}><p className="modal-copy intro-copy">Elige un nombre para identificar este espacio. Tus tomas quedan vinculadas a un perfil anónimo, aunque otra persona use el mismo nombre.</p><form className="form-stack" onSubmit={saveProfile}><label className="field-label">Tu nombre<input autoFocus name="displayName" placeholder="Por ejemplo, Sxmy" maxLength={40} required /></label><p className="privacy-note"><ShieldCheck size={15} />{cloud ? "Tu identidad se recordará en este navegador." : "Tu registro seguirá disponible aquí."}</p><button className="primary-button full-button">Empezar mi registro<ChevronRight size={17} /></button></form></Modal>}
  </div>;
}
export default App;
