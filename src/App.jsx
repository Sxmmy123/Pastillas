import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bell, BellOff, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, LoaderCircle, Plus, Printer, Repeat2, Settings2, ShieldCheck, Trash2, X } from "lucide-react";
import useJournal from "./useJournal";
import { makeId } from "./storage";
import { addDays, addMonths, atTime, dateLabel, durationLabel, entriesFor, frequentMedicines, isDue, monthTitle, norm, rangeFor, timeForDay, timeLabel, today } from "./calendar";

const COLORS = ["mint", "coral", "blue", "lavender", "sun", "teal"];
function mark(name) {
  const value = norm(name); let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return { tone: name === "Pastilla sin especificar" ? "neutral" : COLORS[Math.abs(hash) % COLORS.length], shape: /capsula|capsule|gelcap/.test(value) ? "cap" : /pastilla|tableta|comprimido|tablet/.test(value) ? "tab" : Math.abs(hash >> 3) % 2 ? "cap" : "tab" };
}
function Med({ name, small = false }) {
  const style = mark(name);
  return <span className={"medicine-mark " + style.tone + (small ? " small" : "")} aria-hidden="true">
    {style.shape === "cap" ? <svg viewBox="0 0 48 48"><g transform="rotate(-38 24 24)"><rect x="8" y="15" width="32" height="18" rx="9" fill="currentColor" /><path d="M24 15v18" stroke="white" strokeOpacity=".8" strokeWidth="2" /><path d="M24 16h7a8 8 0 0 1 0 16h-7z" fill="white" fillOpacity=".55" /></g></svg> : <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="currentColor" /><path d="M14 24h20" stroke="white" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" /></svg>}
  </span>;
}
function Modal({ title, sub, onClose, children, wide = false, report = false }) {
  const card = useRef(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!card.current?.contains(document.activeElement)) card.current?.querySelector("button, input, select")?.focus();
    function keydown(event) {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const elements = [...card.current.querySelectorAll("button, input, select, textarea, a[href]")].filter((el) => !el.disabled && el.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className={"modal-backdrop" + (report ? " report-modal" : "")} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={card} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={"modal-card" + (wide ? " modal-wide" : "")}>
      <div className="modal-heading"><div><p className="eyebrow">{sub}</p><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></div>
      {children}
    </section>
  </div>;
}
function QuickLogModal({ date, frequent, suggestions, onClose, onSave }) {
  const [medicine, setMedicine] = useState(""), [pickedDate, setDate] = useState(date), [custom, setCustom] = useState(false), [time, setTime] = useState(timeLabel(Date.now(), true)), [error, setError] = useState("");
  function save(value) {
    const name = value.trim();
    if (!name) { setError("Escribe el nombre de la pastilla."); return; }
    if (!pickedDate || pickedDate > today()) { setError("Elige hoy o una fecha anterior para una toma realizada."); return; }
    const takenAt = custom ? atTime(pickedDate, time) : timeForDay(pickedDate);
    if (!takenAt || takenAt > Date.now()) { setError("La hora de una toma realizada no puede estar en el futuro."); return; }
    try { onSave({ medicine: name, date: pickedDate, status: "taken", takenAt, plannedTime: null }); }
    catch (err) { setError(err.message); }
  }
  return <Modal title="¿Qué pastilla tomaste?" sub="REGISTRO DE TOMAS" onClose={onClose}>
    <div className="log-when"><CalendarDays size={16} /><span>{dateLabel(pickedDate || date, true)}</span><span className="log-time"><Clock3 size={14} />{custom ? time : "Hora automática"}</span></div>
    {!!frequent.length && <div className="frequent-section"><div className="mini-heading"><b>Tus más registradas</b><span>Un toque para guardar</span></div><div className="frequent-grid">{frequent.map((item) => <button className="frequent-button" key={norm(item.name)} onClick={() => save(item.name)} aria-label={"Registrar " + item.name + " como tomada"}><Med name={item.name} small /><span><b>{item.name}</b><small>{item.count} {item.count === 1 ? "registro" : "registros"}</small></span><Plus size={16} /></button>)}</div><div className="form-divider"><span>o escribe otra pastilla</span></div></div>}
    <form className="form-stack" onSubmit={(event) => { event.preventDefault(); save(medicine); }}>
      <label className="field-label">Nombre de la pastilla<input autoFocus={!frequent.length} list="medicine-suggestions" value={medicine} onChange={(event) => { setMedicine(event.target.value); setError(""); }} placeholder="Ej. Cortypiren" maxLength={70} required /></label>
      <datalist id="medicine-suggestions">{suggestions.map((name) => <option key={name} value={name} />)}</datalist>
      <button type="button" className="text-button time-toggle" onClick={() => setCustom((value) => !value)}>{custom ? "Usar la hora automática" : "Cambiar fecha u hora"}<ChevronRight size={14} /></button>
      {custom && <div className="form-two-columns"><label className="field-label">Fecha<input type="date" max={today()} value={pickedDate} onChange={(event) => setDate(event.target.value)} required /></label><label className="field-label">Hora<input type="time" step="1" value={time} onChange={(event) => setTime(event.target.value)} required /></label></div>}
      {date !== today() && !custom && <p className="hint">Esta toma se guardará en la fecha seleccionada con la hora actual. Puedes ajustar la hora si la recuerdas.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-button"><CheckCircle2 size={18} />Guardar toma</button>
    </form>
  </Modal>;
}
function PlanModal({ date, suggestions, onClose, onSave }) {
  const [medicine, setMedicine] = useState(""), [startDate, setStartDate] = useState(date), [time, setTime] = useState("09:00");
  const [interval, setInterval] = useState("1"), [intervalUnit, setIntervalUnit] = useState("days"), [duration, setDuration] = useState("1"), [durationUnit, setDurationUnit] = useState("weeks"), [indefinite, setIndefinite] = useState(false), [error, setError] = useState("");
  function submit(event) {
    event.preventDefault(); const repeat = Number(interval), length = Number(duration);
    if (!medicine.trim()) { setError("Escribe el nombre del medicamento."); return; }
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 365 || (!indefinite && (!Number.isInteger(length) || length < 1 || length > 365))) { setError("El intervalo y la duración deben ser números enteros entre 1 y 365."); return; }
    try { onSave({ id: makeId(), medicine: medicine.trim(), startDate, time, interval: repeat, intervalUnit, duration: indefinite ? 0 : length, durationUnit, active: true, createdAt: Date.now(), updatedAt: Date.now() }); }
    catch (err) { setError(err.message); }
  }
  return <Modal title="Nuevo tratamiento" sub="MEDICACIÓN PROGRAMADA" onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <label className="field-label">Nombre del medicamento<input autoFocus list="plan-medicines" value={medicine} onChange={(event) => setMedicine(event.target.value)} placeholder="Ej. Cortypiren" maxLength={70} required /></label>
      <datalist id="plan-medicines">{suggestions.map((name) => <option key={name} value={name} />)}</datalist>
      <div className="form-two-columns"><label className="field-label">Empieza el<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label><label className="field-label">Hora prevista<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label></div>
      <div className="schedule-builder"><Repeat2 size={17} /><span>Cada</span><input aria-label="Intervalo" type="number" min="1" max="365" value={interval} onChange={(event) => setInterval(event.target.value)} /><select aria-label="Unidad del intervalo" value={intervalUnit} onChange={(event) => setIntervalUnit(event.target.value)}><option value="days">días</option><option value="weeks">semanas</option></select></div>
      <label className="field-label">Duración<select value={indefinite ? "forever" : "limited"} onChange={(event) => setIndefinite(event.target.value === "forever")}><option value="limited">Por un tiempo definido</option><option value="forever">Sin fecha de finalización</option></select></label>
      {!indefinite && <div className="schedule-builder"><span>Durante</span><input aria-label="Duración" type="number" min="1" max="365" value={duration} onChange={(event) => setDuration(event.target.value)} /><select aria-label="Unidad de duración" value={durationUnit} onChange={(event) => setDurationUnit(event.target.value)}><option value="days">días</option><option value="weeks">semanas</option><option value="months">meses</option></select></div>}
      <p className="hint">Aparecerá en el calendario de tratamientos en cada fecha prevista.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-button"><CalendarDays size={18} />Guardar tratamiento</button>
    </form>
  </Modal>;
}
function CalendarEntry({ dose, detailed = false }) {
  return <span className={"calendar-pill " + mark(dose.medicine).tone + (dose.status !== "taken" ? " pill-planned" : "")} title={dose.medicine + " · " + (dose.status === "taken" ? "Tomada" : "Programada")}><Med name={dose.medicine} small /><span className="pill-copy"><b>{dose.legacy ? "Sin especificar" : dose.medicine}</b>{detailed && <small>{dose.status === "taken" ? (dose.takenAt ? timeLabel(dose.takenAt) + " · Tomada" : "Tomada · Sin hora") : dose.plannedTime + " · Programada"}</small>}</span>{dose.status === "taken" && <Check size={12} className="pill-check" />}</span>;
}
function MonthGrid({ year, month, selected, getEntries, onSelect, compact = false }) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7, total = new Date(year, month + 1, 0).getDate();
  const days = [...Array(offset).fill(0), ...Array.from({ length: total }, (_, i) => i + 1)];
  return <div className={"calendar-grid" + (compact ? " mini-calendar-grid" : "")}>
    {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => <span className="calendar-weekday" key={label}>{compact ? label[0] : label}</span>)}
    {days.map((n, i) => {
      if (!n) return <span className="calendar-blank" key={"blank-" + i} />;
      const date = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(n).padStart(2, "0"), doses = getEntries(date);
      return <button key={date} className={"calendar-day" + (selected === date ? " selected" : "") + (today() === date ? " is-today" : "")} onClick={() => onSelect(date)} aria-label={dateLabel(date) + ", " + doses.length + " tomas"}>
        <span className="day-number">{n}</span>{compact ? (doses.length > 0 && <span className="mini-dose-bar" />) : <span className="day-pills">{doses.slice(0, 2).map((dose) => <CalendarEntry key={dose.id} dose={dose} />)}{doses.length > 2 && <span className="more-doses">+{doses.length - 2} más</span>}</span>}
      </button>;
    })}
  </div>;
}
function CalendarPanel({ day, view, section, records, plans, onDay, onToday, onView, onShift }) {
  const date = new Date(day + "T12:00:00"), [start, end] = rangeFor(day, view);
  const getEntries = (key) => entriesFor(key, section, records, plans);
  const title = view === "year" ? day.slice(0, 4) : view === "week" ? dateLabel(start, true) + " – " + dateLabel(end, true) : monthTitle(day);
  const saved = records.filter((item) => item.status === "taken" && item.date >= start && item.date <= end && (section === "treatments" ? !!item.planId : !item.planId));
  return <section className={"calendar-panel " + section} aria-label={section === "treatments" ? "Calendario de tratamientos" : "Calendario de tomas"}>
    <div className="calendar-toolbar"><div className="calendar-navigation"><button className="icon-button" onClick={() => onShift(-1)} aria-label="Periodo anterior"><ChevronLeft size={20} /></button><h2>{title}</h2><button className="icon-button" onClick={() => onShift(1)} aria-label="Periodo siguiente"><ChevronRight size={20} /></button><button className="today-button" onClick={onToday}>Hoy</button></div><div className="calendar-mode" role="group" aria-label="Vista del calendario">{[["month", "Mes"], ["week", "Semana"], ["year", "Año"]].map(([key, label]) => <button key={key} aria-pressed={view === key} className={view === key ? "active" : ""} onClick={() => onView(key)}>{label}</button>)}</div></div>
    {view === "month" && <MonthGrid year={date.getFullYear()} month={date.getMonth()} selected={day} getEntries={getEntries} onSelect={onDay} />}
    {view === "week" && <div className="week-calendar">{Array.from({ length: 7 }, (_, i) => {
      const key = addDays(start, i), doses = getEntries(key);
      return <button key={key} className={"week-day-card" + (key === day ? " selected" : "") + (key === today() ? " is-today" : "")} onClick={() => onDay(key)} aria-label={dateLabel(key) + ", " + doses.length + " tomas"}><span className="week-date"><small>{new Intl.DateTimeFormat("es-BO", { weekday: "short" }).format(new Date(key + "T12:00:00"))}</small><b>{Number(key.slice(-2))}</b></span><span className="week-pills">{doses.length ? doses.map((dose) => <CalendarEntry key={dose.id} dose={dose} detailed />) : <span className="week-empty">{section === "treatments" ? "Sin tomas previstas" : "Sin registros"}</span>}</span></button>;
    })}</div>}
    {view === "year" && <div className="year-calendar">{Array.from({ length: 12 }, (_, month) => <article className="year-month" key={month}><h3>{new Intl.DateTimeFormat("es-BO", { month: "long" }).format(new Date(date.getFullYear(), month, 1))}</h3><MonthGrid year={date.getFullYear()} month={month} selected={day} getEntries={getEntries} onSelect={onDay} compact /></article>)}</div>}
    <div className="calendar-footer"><span><CheckCircle2 size={14} /><b>{saved.length}</b> {saved.length === 1 ? "toma registrada" : "tomas registradas"} en este periodo</span><span>Pulsa un día para ver sus pastillas</span></div>
  </section>;
}
function DoseRow({ dose, records, onTake, onDelete }) {
  const previous = dose.takenAt && records.filter((item) => item.id !== dose.id && item.takenAt && item.takenAt < dose.takenAt && norm(item.medicine) === norm(dose.medicine)).sort((a, b) => b.takenAt - a.takenAt)[0];
  const delta = dose.plannedTime && dose.takenAt ? dose.takenAt - atTime(dose.date, dose.plannedTime) : null;
  return <article className="dose-row"><Med name={dose.medicine} /><div className="dose-copy"><h3>{dose.medicine}</h3><span className={"dose-status " + (dose.status === "taken" ? "taken" : "")}>
    {dose.status === "taken" ? <><CheckCircle2 size={13} />Tomada{dose.takenAt ? " · " + timeLabel(dose.takenAt, true) : " · Hora no registrada"}</> : <><Clock3 size={13} />Programada · {dose.plannedTime}</>}
  </span>{dose.legacy && <small>Registro del calendario anterior</small>}{delta !== null && <small>Prevista {dose.plannedTime} · {delta === 0 ? "A tiempo" : durationLabel(delta) + (delta < 0 ? " antes" : " después")}</small>}{previous && <small>{durationLabel(dose.takenAt - previous.takenAt)} desde la toma anterior</small>}</div>
    {!dose.legacy && <div className="dose-actions">{dose.status !== "taken" ? <button className="take-button" disabled={dose.date > today()} onClick={() => onTake(dose)}><Check size={16} /><span>Tomada</span></button> : <button className="icon-button delete-button" onClick={() => onDelete(dose)} aria-label={"Eliminar registro de " + dose.medicine}><Trash2 size={16} /></button>}</div>}
  </article>;
}
function ReportModal({ day, view, records, name, onClose }) {
  const [anchor, setAnchor] = useState(day), [period, setPeriod] = useState(view), [scope, setScope] = useState("all");
  const [start, end] = rangeFor(anchor, period);
  const list = records.filter((item) => item.status === "taken" && item.date >= start && item.date <= end && (scope === "all" || (scope === "treatments" ? !!item.planId : !item.planId))).sort((a, b) => a.date.localeCompare(b.date) || (a.takenAt || 0) - (b.takenAt || 0));
  const totals = new Map(); list.forEach((item) => { const key = norm(item.medicine), previous = totals.get(key) || { name: item.medicine, count: 0 }; previous.count++; totals.set(key, previous); });
  return <Modal title="Informe de seguimiento" sub="PARA TI Y TU MÉDICO" wide report onClose={onClose}>
    <div className="report-controls"><label className="field-label">Periodo<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="week">Semana</option><option value="month">Mes</option><option value="year">Año</option></select></label><label className="field-label">Fecha de referencia<input type="date" value={anchor} onChange={(event) => event.target.value && setAnchor(event.target.value)} /></label><label className="field-label">Registros<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">Todas las tomas</option><option value="records">Uso ocasional</option><option value="treatments">Tratamientos</option></select></label></div>
    <div className="report-content"><div className="report-title"><span className="eyebrow">PASTILLAS · REGISTRO PERSONAL</span><h2>{name ? "Seguimiento de " + name : "Seguimiento de medicamentos"}</h2><p>{dateLabel(start, true)} — {dateLabel(end, true)}</p></div><div className="report-summary"><b>{list.length} tomas</b><span>{new Set(list.map((item) => item.date)).size} días con registros</span><span>{totals.size} medicamentos</span></div>
      {!!list.length && <div className="report-totals">{[...totals.values()].sort((a, b) => b.count - a.count).map((item) => <span key={norm(item.name)}>{item.name}<b>{item.count}</b></span>)}</div>}
      {list.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Fecha</th><th>Medicamento</th><th>Hora de toma</th><th>Tipo</th></tr></thead><tbody>{list.map((item) => <tr key={item.id}><td>{dateLabel(item.date, true)}</td><td>{item.medicine}</td><td>{item.takenAt ? timeLabel(item.takenAt, true) : "No registrada"}</td><td>{item.legacy ? "Histórico" : item.planId ? "Tratamiento" : "Ocasional"}</td></tr>)}</tbody></table></div> : <div className="empty-state"><FileText size={25} /><b>No hay tomas en este periodo</b><p>Elige otro mes, semana o año para consultar el historial.</p></div>}
      {list.some((item) => item.legacy) && <p className="report-note">Las fechas históricas conservan el registro original. No se conocen el medicamento ni la hora de esas tomas.</p>}
    </div>
    <button className="primary-button full-button report-action" disabled={!list.length} onClick={() => window.print()}><Printer size={18} />Imprimir o guardar PDF</button>
  </Modal>;
}

export default function App() {
  const journal = useJournal();
  const { records, plans, name, reminders, sync, cloudError } = journal;
  const [section, setSection] = useState("records"), [day, setDay] = useState(today), [view, setView] = useState("month"), [modal, setModal] = useState(""), [selected, setSelected] = useState(null), [returnTo, setReturnTo] = useState(""), [toast, setToast] = useState("");
  const startupShown = useRef(false);
  const frequent = useMemo(() => frequentMedicines(records), [records]);
  const suggestions = useMemo(() => {
    const names = new Map(); [...records.filter((item) => !item.legacy), ...plans].forEach((item) => { if (item.medicine) names.set(norm(item.medicine), item.medicine); }); return [...names.values()].sort((a, b) => a.localeCompare(b, "es"));
  }, [records, plans]);
  const doses = entriesFor(day, section, records, plans), activePlans = plans.filter((plan) => plan.active);
  const remainingToday = entriesFor(today(), "treatments", records, plans).filter((dose) => dose.status !== "taken");
  const legacy = records.filter((item) => item.legacy), latestLegacy = legacy.map((item) => item.date).sort().at(-1);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((value) => value[0]?.toUpperCase()).join("") || "T";
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 4200); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!startupShown.current && plans.length) { startupShown.current = true; if (reminders && remainingToday.length) setModal((current) => current || "reminder"); }
  }, [plans.length, reminders, remainingToday.length]);
  useEffect(() => {
    if (!reminders || !("Notification" in window) || Notification.permission !== "granted") return;
    const timers = [];
    plans.filter((plan) => isDue(plan, today())).forEach((plan) => {
      const taken = records.some((item) => item.planId === plan.id && item.date === today() && item.status === "taken"), due = atTime(today(), plan.time);
      if (!taken && due > Date.now()) timers.push(setTimeout(async () => {
        try { const registration = await navigator.serviceWorker?.getRegistration(); if (registration?.showNotification) await registration.showNotification("Hora de tu medicamento", { body: plan.medicine + " · " + plan.time, icon: "./icon.svg", tag: plan.id + "-" + today() }); else new Notification("Hora de tu medicamento", { body: plan.medicine + " · " + plan.time }); } catch {}
      }, due - Date.now()));
    });
    return () => timers.forEach(clearTimeout);
  }, [plans, records, reminders, permission]);
  function openDay(date) { setDay(date); setModal("day"); }
  function openQuick(from = "") { if (day > today()) setDay(today()); setReturnTo(from); setModal("quick-log"); }
  function changeSection(next) { setSection(next); setModal(""); }
  function shift(direction) { if (view === "year") setDay(addMonths(day, direction * 12)); else setDay(view === "week" ? addDays(day, direction * 7) : addMonths(day, direction)); }
  function saveLog(data) { journal.saveRecord(data); setDay(data.date); setSection("records"); setModal(""); setToast(data.medicine + " · Toma guardada"); }
  function takeDose(dose) { try { journal.takeDose(dose); setToast(dose.medicine + " · Toma guardada"); } catch (err) { setToast(err.message); } }
  function savePlan(plan) { journal.savePlan(plan); setDay(plan.startDate); setSection("treatments"); setModal(""); setToast("Tratamiento programado"); }
  const isTreatment = section === "treatments";
  return <div className="app-shell">
    <aside className="desktop-sidebar"><a className="brand" href="./"><span className="brand-icon"><Activity size={22} /></span><span>pastillas<span className="brand-dot">.</span><small>MI REGISTRO PERSONAL</small></span></a><div className="side-label">MIS CALENDARIOS</div>
      <button className={"side-link" + (!isTreatment ? " active" : "")} aria-current={!isTreatment ? "page" : undefined} onClick={() => changeSection("records")}><CalendarDays size={19} />Mis tomas</button><button className={"side-link" + (isTreatment ? " active" : "")} aria-current={isTreatment ? "page" : undefined} onClick={() => changeSection("treatments")}><Repeat2 size={19} />Tratamientos{activePlans.length > 0 && <span className="nav-count">{activePlans.length}</span>}</button>
      <div className="side-label side-label-secondary">SEGUIMIENTO</div><button className="side-link" onClick={() => setModal("report")}><FileText size={19} />Informe para el médico</button>
      <div className="sidebar-bottom"><div className="sidebar-note"><ShieldCheck size={20} /><p>Un día a la vez.<br /><span>Tu historial siempre a mano.</span></p></div><button className="profile-button" onClick={() => setModal("profile")}><span className="avatar">{initials}</span><span className="profile-copy"><b>{name || "Tu perfil"}</b><small>Perfil y recordatorios</small></span><Settings2 size={17} /></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="mobile-brand"><span className="brand-icon"><Activity size={19} /></span><b>pastillas<span className="brand-dot">.</span></b></div><div className="sync-indicator" title={cloudError || "Tus registros se guardan también en este navegador."}>{sync === "connecting" || sync === "syncing" ? <LoaderCircle size={13} className="spinner" /> : <span className={"sync-dot" + (sync === "online" ? " is-online" : "")} />}<span>{sync === "online" ? "Sincronizado" : sync === "syncing" || sync === "connecting" ? "Conectando" : "En este dispositivo"}</span></div><button className="icon-button mobile-report" aria-label="Informe de seguimiento" onClick={() => setModal("report")}><FileText size={20} /></button><button className="avatar top-avatar" onClick={() => setModal("profile")} aria-label="Perfil y recordatorios">{initials}</button></header>
      <div className="calendar-content"><section className="page-heading"><div><p className="eyebrow">{isTreatment ? "TU RUTINA, ORGANIZADA" : "TU HISTORIAL PERSONAL"}</p><h1>{isTreatment ? "Tratamientos" : "Mis tomas"}<span className="heading-spark">✦</span></h1><p>{isTreatment ? "Medicación programada y seguimiento de tus recetas." : "Pastillas de uso ocasional y tus registros anteriores."}</p></div><div className="heading-actions">{isTreatment && <button className="secondary-button manage-button" onClick={() => setModal("plans")}><Settings2 size={17} /><span>Administrar</span></button>}<button className="primary-button desktop-action" onClick={() => isTreatment ? setModal("plan") : openQuick()}><Plus size={18} />{isTreatment ? "Programar" : "Registrar toma"}</button></div></section>
        <CalendarPanel day={day} view={view} section={section} records={records} plans={plans} onDay={openDay} onToday={() => setDay(today())} onView={setView} onShift={shift} />
        {!isTreatment && legacy.length > 0 && <button className="history-link" onClick={() => { setDay(latestLegacy); setView("month"); }}><Clock3 size={15} /><span>{legacy.length} {legacy.length === 1 ? "registro anterior conservado" : "registros anteriores conservados"}</span><span>Ver último mes<ChevronRight size={14} /></span></button>}
        {isTreatment && plans.length === 0 && <p className="calendar-guidance">Pulsa + para crear tu primer tratamiento. Sus tomas aparecerán aquí en las fechas programadas.</p>}
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Secciones principales"><button className={"mobile-nav-link" + (!isTreatment ? " active" : "")} aria-current={!isTreatment ? "page" : undefined} onClick={() => changeSection("records")}><CalendarDays size={21} /><span>Mis tomas</span></button><button className="mobile-add" onClick={() => isTreatment ? setModal("plan") : openQuick()} aria-label={isTreatment ? "Programar tratamiento" : "Registrar toma"}><Plus size={25} /></button><button className={"mobile-nav-link" + (isTreatment ? " active" : "")} aria-current={isTreatment ? "page" : undefined} onClick={() => changeSection("treatments")}><Repeat2 size={21} /><span>Tratamientos</span></button></nav>
    {toast && <div className="toast" role="status"><CheckCircle2 size={18} /><span>{toast}</span><button onClick={() => setToast("")} aria-label="Cerrar aviso"><X size={16} /></button></div>}
    {modal === "day" && <Modal title={dateLabel(day)} sub={isTreatment ? "TRATAMIENTOS DEL DÍA" : "TOMAS DEL DÍA"} onClose={() => setModal("")}><div className="day-modal-list">{doses.length ? doses.map((dose) => <DoseRow key={dose.id} dose={dose} records={records} onTake={takeDose} onDelete={(item) => { setSelected(item); setModal("delete"); }} />) : <div className="empty-state"><CalendarDays size={27} /><b>{isTreatment ? "Sin tomas programadas" : "No hay tomas en esta fecha"}</b><p>{isTreatment ? "Los tratamientos aparecerán según su repetición." : day > today() ? "Aquí verás las pastillas que registres ese día." : "Si olvidaste registrar una pastilla, puedes añadirla aquí."}</p></div>}</div><button className="primary-button full-button" disabled={!isTreatment && day > today()} onClick={() => isTreatment ? setModal("plan") : openQuick("day")}><Plus size={18} />{isTreatment ? "Programar tratamiento" : "Registrar una toma en este día"}</button></Modal>}
    {modal === "quick-log" && <QuickLogModal date={day} frequent={frequent} suggestions={suggestions} onClose={() => setModal(returnTo)} onSave={saveLog} />}
    {modal === "plan" && <PlanModal date={day} suggestions={suggestions} onClose={() => setModal("")} onSave={savePlan} />}
    {modal === "plans" && <Modal title="Tus tratamientos" sub="ADMINISTRAR MEDICACIÓN" onClose={() => setModal("")}><div className="plan-list">{plans.length ? plans.map((plan) => <article className={"treatment-card" + (!plan.active ? " treatment-paused" : "")} key={plan.id}><Med name={plan.medicine} /><div className="treatment-copy"><b>{plan.medicine}</b><span>Cada {plan.interval} {plan.intervalUnit === "weeks" ? "semana(s)" : "día(s)"} · {plan.time}</span><small>{plan.active ? "Activo desde " + dateLabel(plan.startDate, true) : "Pausado"}</small></div><button className={"switch-button" + (plan.active ? " is-on" : "")} role="switch" aria-checked={plan.active} aria-label={(plan.active ? "Pausar " : "Activar ") + plan.medicine} onClick={() => journal.togglePlan(plan)}><span /></button></article>) : <div className="empty-state"><Repeat2 size={25} /><b>Aún no tienes tratamientos</b><p>Programa la medicación de tu receta para verla en su calendario.</p></div>}</div><button className="primary-button full-button" onClick={() => setModal("plan")}><Plus size={18} />Nuevo tratamiento</button></Modal>}
    {modal === "report" && <ReportModal day={day} view={view} records={records} name={name} onClose={() => setModal("")} />}
    {modal === "delete" && selected && <Modal title="¿Eliminar esta toma?" sub="CONFIRMAR CAMBIO" onClose={() => setModal("day")}><div className="confirm-med"><Med name={selected.medicine} /><div><b>{selected.medicine}</b><span>{dateLabel(selected.date, true)} · {timeLabel(selected.takenAt)}</span></div></div><p className="modal-copy">Se quitará de tu historial.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setModal("day")}>Conservar</button><button className="danger-button" onClick={() => { try { journal.removeRecord(selected); setSelected(null); setModal("day"); } catch (err) { setToast(err.message); } }}><Trash2 size={16} />Eliminar</button></div></Modal>}
    {modal === "profile" && <Modal title="Perfil y recordatorios" sub="ESPACIO PERSONAL" onClose={() => setModal("")}><div className="profile-identity"><span className="avatar avatar-large">{initials}</span><div><b>{name || "Tu perfil"}</b><span>Identificador · {journal.uid.slice(0, 8)}</span></div></div><form className="form-stack" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("displayName")?.toString().trim(); if (value) { journal.saveName(value); setModal(""); setToast("Nombre guardado"); } }}><label className="field-label">Tu nombre<input name="displayName" defaultValue={name} placeholder="¿Cómo te llamamos?" maxLength={40} required /></label><button className="primary-button full-button">Guardar nombre</button></form><div className="settings-divider" /><div className="settings-line"><div><b>Recordatorio al abrir</b><span>Ver las tomas de tratamiento pendientes de hoy.</span></div><button className={"switch-button" + (reminders ? " is-on" : "")} role="switch" aria-checked={reminders} aria-label="Recordatorio al abrir" onClick={() => journal.changeReminders(!reminders)}><span /></button></div><div className="settings-line"><span className="settings-icon">{permission === "granted" ? <Bell size={19} /> : <BellOff size={19} />}</span><div><b>Avisos del navegador</b><span>{permission === "denied" ? "Bloqueados en este navegador." : permission === "unsupported" ? "No disponibles en este navegador." : "Mientras la app esté abierta."}</span></div>{permission === "default" && <button className="text-button" onClick={async () => { if (await Notification.requestPermission() === "granted") { setModal(""); setToast("Avisos activados"); } }}>Activar</button>}{permission === "granted" && <CheckCircle2 size={19} className="permission-ok" />}</div><p className="privacy-note"><ShieldCheck size={15} />Tu nombre identifica el perfil. Los datos pertenecen a la identidad anónima de este navegador.</p>{cloudError && <div className="cloud-detail"><b>Guardado local activo</b><p>No se pudo sincronizar con Firebase. Tus registros siguen disponibles en este navegador.</p><code>{cloudError}</code></div>}<p className="hint">Para ver tus registros antiguos, usa el mismo navegador y la misma dirección donde los guardaste.</p></Modal>}
    {modal === "reminder" && <Modal title="Tus tomas de hoy" sub="RECORDATORIO PERSONAL" onClose={() => setModal("")}><div className="reminder-intro"><Bell size={21} /><p>{remainingToday.length} {remainingToday.length === 1 ? "toma programada pendiente" : "tomas programadas pendientes"} para hoy.</p></div><div className="day-modal-list">{remainingToday.map((dose) => <DoseRow key={dose.id} dose={dose} records={records} onTake={takeDose} onDelete={() => {}} />)}</div><div className="modal-actions"><button className="text-button" onClick={() => { journal.changeReminders(false); setModal(""); }}>Desactivar avisos</button><button className="primary-button" onClick={() => { setSection("treatments"); setDay(today()); setModal(""); }}>Ver tratamientos</button></div></Modal>}
  </div>;
}
