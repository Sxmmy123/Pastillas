import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bell, BellOff, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, LoaderCircle, Pencil, Plus, Printer, Repeat2, Settings2, ShieldCheck, Trash2, X } from "lucide-react";
import useJournal from "./useJournal";
import useCalendarSwipe from "./useCalendarSwipe";
import usePendingRegistrations from "./usePendingRegistrations";
import MedicineCatalog from "./MedicineCatalog";
import { makeId } from "./storage";
import { addDays, addMonths, atTime, dateLabel, durationLabel, entriesFor, frequentMedicines, isDue, isNamedMedicine, medicineLabel, monthTitle, norm, rangeFor, timeLabel, today } from "./calendar";

const COLORS = ["mint", "coral", "blue", "lavender", "sun", "teal"];
function mark(name) {
  const value = norm(name); let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return { tone: !isNamedMedicine(name) ? "neutral" : COLORS[Math.abs(hash) % COLORS.length], shape: !isNamedMedicine(name) || /capsula|capsule|gelcap/.test(value) ? "cap" : /pastilla|tableta|comprimido|tablet/.test(value) ? "tab" : Math.abs(hash >> 3) % 2 ? "cap" : "tab" };
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
function cloudErrorMessage(code) {
  if (code === "permission-denied") return "Falta publicar las nuevas reglas de Firebase para permitir la entrada por nombre. Tus registros anteriores siguen guardados.";
  if (code === "auth/admin-restricted-operation" || code === "auth/operation-not-allowed") return "Activa el acceso Anónimo en Authentication del proyecto regis-b73aa.";
  if (code === "unavailable" || code === "auth/network-request-failed") return "No se pudo conectar con Firebase. Comprueba tu conexión y vuelve a intentarlo.";
  return "No se pudo cargar o sincronizar el historial con Firebase. Tus copias locales se conservan.";
}

function NameEntryModal({ name, onClose, onEnter }) {
  const [value, setValue] = useState(name || ""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Modal title="Entra a tu historial" sub="TU PERFIL, EN CUALQUIER DISPOSITIVO" onClose={onClose}>
    <div className="name-entry-mark"><Med name="cápsula" /><p>Escribe tu nombre para abrir el mismo historial en tu celular o computadora.</p></div>
    <form className="form-stack" onSubmit={async (event) => { event.preventDefault(); if (busy) return; setBusy(true); setError(""); try { await onEnter(value); } catch (cause) { setError(cause.message); setBusy(false); } }}>
      <label className="field-label">Tu nombre<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ej. Sxmy" autoComplete="username" autoCapitalize="none" autoCorrect="off" maxLength={40} required disabled={busy} /></label>
      <p className="hint">Usa siempre el mismo nombre, respetando las mayúsculas. Este dispositivo lo recordará.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-button" disabled={busy}>{busy ? <LoaderCircle size={18} className="spinner" /> : <ChevronRight size={18} />}{busy ? "Abriendo historial…" : "Entrar"}</button>
    </form>
  </Modal>;
}

function ProfileModal({ journal, initials, permission, onClose, onToast, onRecover, onChangeName }) {
  const [recovery, setRecovery] = useState(null), [error, setError] = useState("");
  const { name, records, reminders, cloudError, sync, loadedCloudRecords, savedHistories } = journal;
  const busy = sync === "connecting" || sync === "syncing";
  return <Modal title="Perfil y recordatorios" sub="ESPACIO PERSONAL" onClose={onClose}>
    <div className="profile-identity"><span className="avatar avatar-large">{initials}</span><div><b>{name || "Tu perfil"}</b><span>{journal.profileId ? "Mismo nombre, mismo historial" : "Entra con tu nombre para compartir el historial"}</span></div></div>
    <div className="profile-data-summary"><span><b>{records.length}</b> tomas disponibles</span><span>{loadedCloudRecords === null ? "Firebase: pendiente de cargar" : <><b>{loadedCloudRecords}</b> tomas cargadas de Firebase</>}</span></div>
    {cloudError && <div className="cloud-detail" role="alert"><b>No se pudo sincronizar</b><p>{cloudErrorMessage(cloudError)}</p><code>{cloudError}</code>{cloudError === "permission-denied" && <p><a href="./configurar-firebase.html" target="_blank" rel="noreferrer">Copiar las nuevas reglas</a></p>}</div>}
    <button className="secondary-button full-button sync-retry" disabled={busy} onClick={journal.reconnect}>{busy ? <LoaderCircle size={17} className="spinner" /> : <Repeat2 size={17} />}{busy ? "Cargando historial…" : "Volver a cargar desde Firebase"}</button>
    {!!savedHistories.length && <section className="local-recovery"><h3>Historial guardado en este navegador</h3><p>Hay una copia de otra sesión. Puedes añadirla al historial actual conservando la original.</p>{savedHistories.map((history) => <button className="recovery-option" key={history.uid} onClick={() => { setRecovery(history); setError(""); }}><Clock3 size={18} /><span><b>{history.name}</b><small>{history.count} {history.count === 1 ? "toma por recuperar" : "tomas por recuperar"}{history.plans.length ? " · Con tratamientos" : ""}{history.latest ? " · " + dateLabel(history.latest, true) : ""}</small><code>{history.uid}</code></span><ChevronRight size={17} /></button>)}
      {recovery && <div className="recovery-confirm"><b>¿Añadir la copia de {recovery.name}?</b><p>Sus tomas y tratamientos se guardarán en este perfil y se sincronizarán con Firebase cuando esté disponible. La copia anterior se conserva.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={() => setRecovery(null)}>Cancelar</button><button className="primary-button" onClick={() => { try { const history = journal.restoreLocalHistory(recovery.uid); onRecover(history); } catch (cause) { setError(cause.message); } }}>Recuperar copia</button></div></div>}
    </section>}
    <div className="settings-divider" />
    <button className="secondary-button full-button" onClick={onChangeName}>{journal.profileId ? "Entrar con otro nombre" : "Entrar con mi nombre"}<ChevronRight size={17} /></button>
    <div className="settings-divider" /><div className="settings-line"><div><b>Recordatorio al abrir</b><span>Ver las tomas de tratamiento pendientes de hoy.</span></div><button className={"switch-button" + (reminders ? " is-on" : "")} role="switch" aria-checked={reminders} aria-label="Recordatorio al abrir" onClick={() => journal.changeReminders(!reminders)}><span /></button></div>
    <div className="settings-line"><span className="settings-icon">{permission === "granted" ? <Bell size={19} /> : <BellOff size={19} />}</span><div><b>Avisos del navegador</b><span>{permission === "denied" ? "Bloqueados en este navegador." : permission === "unsupported" ? "No disponibles en este navegador." : "Mientras la app esté abierta."}</span></div>{permission === "default" && <button className="text-button" onClick={async () => { if (await Notification.requestPermission() === "granted") { onClose(); onToast("Avisos activados"); } }}>Activar</button>}{permission === "granted" && <CheckCircle2 size={19} className="permission-ok" />}</div>
    <p className="privacy-note"><ShieldCheck size={15} />El perfil se abre con el nombre. Cualquier persona que use exactamente ese nombre comparte este historial.</p>
  </Modal>;
}

function QuickLogModal({ date, frequent, suggestions, initialMedicine = "", delayed = false, onClose, onSave }) {
  const historical = date < today();
  const [medicine, setMedicine] = useState(initialMedicine), [pickedDate, setDate] = useState(date), [custom, setCustom] = useState(historical), [time, setTime] = useState(historical ? "" : timeLabel(Date.now(), true)), [error, setError] = useState("");
  function save(value) {
    const name = value.trim();
    if (!pickedDate || pickedDate > today()) { setError("Elige hoy o una fecha anterior para una toma realizada."); return; }
    if ((custom || pickedDate < today()) && !time) { setError("Indica a qué hora tomaste la pastilla."); return; }
    const takenAt = custom || pickedDate < today() ? atTime(pickedDate, time) : Date.now();
    if (!takenAt || takenAt > Date.now()) { setError("La hora de una toma realizada no puede estar en el futuro."); return; }
    try { onSave({ medicine: name, date: pickedDate, status: "taken", takenAt, plannedTime: null }); }
    catch (err) { setError(err.message); }
  }
  return <Modal title="¿Qué pastilla tomaste?" sub="REGISTRO DE TOMAS" onClose={onClose}>
    <div className="log-when"><CalendarDays size={16} /><span>{dateLabel(pickedDate || date, true)}</span><span className="log-time"><Clock3 size={14} />{custom ? time || "Elige la hora" : "Hora automática"}</span></div>
    {!initialMedicine && !!frequent.length && <div className="frequent-section"><div className="mini-heading"><b>Tus más registradas</b><span>{pickedDate < today() ? "Elige y completa la hora" : "Un toque para guardar"}</span></div><div className="frequent-grid">{frequent.map((item) => <button className="frequent-button" key={norm(item.name)} onClick={() => { if (pickedDate < today() && !time) { setMedicine(item.name); setError(""); } else save(item.name); }} aria-label={"Registrar " + item.name + " como tomada"}><Med name={item.name} small /><span><b>{item.name}</b><small>{item.count} {item.count === 1 ? "registro" : "registros"}</small></span><Plus size={16} /></button>)}</div><div className="form-divider"><span>o escribe otra pastilla</span></div></div>}
    <form className="form-stack" onSubmit={(event) => { event.preventDefault(); save(medicine); }}>
      <label className="field-label"><span>Nombre de la pastilla <small className="optional-label">Opcional</small></span><input autoFocus={!frequent.length && !historical} list="medicine-suggestions" value={medicine} onChange={(event) => { setMedicine(event.target.value); setError(""); }} placeholder="Ej. Cortypiren" maxLength={70} /></label>
      {!medicine.trim() && <p className="hint">Puedes guardar la toma sin nombre y especificarlo después tocando su pastilla en el calendario.</p>}
      <datalist id="medicine-suggestions">{suggestions.map((name) => <option key={name} value={name} />)}</datalist>
      {pickedDate >= today() && <button type="button" className="text-button time-toggle" onClick={() => setCustom((value) => !value)}>{custom ? "Usar la hora automática" : "Cambiar fecha u hora"}<ChevronRight size={14} /></button>}
      {custom && <div className="form-two-columns"><label className="field-label">Fecha<input type="date" max={today()} value={pickedDate} onChange={(event) => { const value = event.target.value; if (value && value < today() && pickedDate >= today()) setTime(""); setDate(value); }} required /></label><label className="field-label">Hora de la toma<input autoFocus={historical && !!initialMedicine} type="time" step="1" value={time} onChange={(event) => setTime(event.target.value)} required /></label></div>}
      {pickedDate < today() && <p className="hint">Indica la hora real de esa toma para mantener un seguimiento preciso.</p>}
      {delayed && <p className="hint">Tendrás 4 segundos para anular el registro antes de que se guarde.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-button"><CheckCircle2 size={18} />{medicine.trim() ? "Guardar toma" : "Guardar sin especificar"}</button>
    </form>
  </Modal>;
}
function NameMedicineModal({ record, suggestions, onClose, onSave, onDelete }) {
  const [medicine, setMedicine] = useState(isNamedMedicine(record.medicine) ? record.medicine : ""), [error, setError] = useState("");
  return <Modal title={isNamedMedicine(record.medicine) ? "Nombre de la pastilla" : "¿Qué pastilla fue?"} sub="COMPLETAR ESTA TOMA" onClose={onClose}>
    <div className="confirm-med"><Med name={medicine} /><div><b>{dateLabel(record.date, true)}</b><span>{record.takenAt ? "Tomada · " + timeLabel(record.takenAt, true) : "Hora no registrada"}</span></div></div>
    <form className="form-stack" onSubmit={(event) => { event.preventDefault(); try { onSave(record.id, medicine); } catch (err) { setError(err.message); } }}>
      <label className="field-label">Nombre de la pastilla<input autoFocus list="rename-medicines" value={medicine} onChange={(event) => setMedicine(event.target.value)} placeholder="Ej. Cortypiren" maxLength={70} /></label>
      <datalist id="rename-medicines">{suggestions.map((name) => <option key={name} value={name} />)}</datalist>
      <p className="hint">El nombre se asignará a esta toma, conservando su fecha y hora.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-button"><Check size={18} />{medicine.trim() ? "Guardar nombre" : "Mantener sin especificar"}</button>
    </form>
    <button className="text-button delete-record-link" onClick={() => onDelete(record)}><Trash2 size={15} />Eliminar esta toma</button>
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
function CalendarEntry({ dose, detailed = false, iconOnly = false, onOpen }) {
  const label = medicineLabel(dose.medicine);
  return <button type="button" className={"calendar-pill " + mark(dose.medicine).tone + (iconOnly ? " pill-icon-only" : "") + (dose.status !== "taken" ? " pill-planned" : "")} title={label + " · " + (dose.status === "taken" ? "Tomada" : "Programada")} aria-label={label + (dose.isVirtual ? ", ver toma programada" : ", especificar o corregir nombre")} onClick={(event) => { event.stopPropagation(); onOpen(dose); }}><Med name={dose.medicine} small />{!iconOnly && <span className="pill-copy"><b>{isNamedMedicine(dose.medicine) ? label : "Sin especificar"}</b>{detailed && <small>{dose.status === "taken" ? (dose.takenAt ? timeLabel(dose.takenAt) + " · Tomada" : "Tomada · Sin hora") : dose.plannedTime + " · Programada"}</small>}</span>}{!iconOnly && dose.status === "taken" && <Check size={12} className="pill-check" />}</button>;
}
function MonthGrid({ year, month, selected, getEntries, onSelect, onEntry, dragDate, compact = false }) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7, total = new Date(year, month + 1, 0).getDate();
  const days = [...Array(offset).fill(0), ...Array.from({ length: total }, (_, i) => i + 1)];
  return <div className={"calendar-grid" + (compact ? " mini-calendar-grid" : "")}>
    {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => <span className="calendar-weekday" key={label}>{compact ? label[0] : label}</span>)}
    {days.map((n, i) => {
      if (!n) return <span className="calendar-blank" key={"blank-" + i} />;
      const date = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(n).padStart(2, "0"), doses = getEntries(date);
      return <div key={date} data-calendar-date={date} className={"calendar-day" + (selected === date ? " selected" : "") + (today() === date ? " is-today" : "") + (dragDate === date ? " is-drop-target" : "")} onClick={() => onSelect(date)}>
        <button className="day-number" aria-label={dateLabel(date) + ", " + doses.length + " tomas"}>{n}</button>{compact ? (doses.length > 0 && <span className="mini-dose-bar" />) : <div className="day-pills">{doses.slice(0, 2).map((dose) => <CalendarEntry key={dose.id} dose={dose} iconOnly onOpen={onEntry} />)}{doses.length > 2 && <button className="more-doses">+{doses.length - 2} más</button>}</div>}
      </div>;
    })}
  </div>;
}
function CalendarPanel({ day, view, section, records, plans, onDay, onEntry, onToday, onView, onShift, dragDate }) {
  const date = new Date(day + "T12:00:00"), [start, end] = rangeFor(day, view);
  const [motion, setMotion] = useState(1);
  function navigate(direction) { setMotion(direction); onShift(direction); }
  const swipe = useCalendarSwipe(navigate);
  const periodLabel = view === "month" ? "mes" : view === "week" ? "semana" : "año";
  const getEntries = (key) => entriesFor(key, section, records, plans);
  const title = view === "year" ? day.slice(0, 4) : view === "week" ? dateLabel(start, true) + " – " + dateLabel(end, true) : monthTitle(day);
  const saved = records.filter((item) => item.status === "taken" && item.date >= start && item.date <= end && (section === "treatments" ? !!item.planId : !item.planId));
  return <section className={"calendar-panel " + section} aria-label={section === "treatments" ? "Calendario de tratamientos" : "Calendario de tomas"}>
    <div className="calendar-toolbar"><div className="calendar-navigation"><h2 aria-live="polite" aria-atomic="true">{title}</h2><button className="today-button" onClick={onToday}>Hoy</button></div><div className="calendar-mode" role="group" aria-label="Vista del calendario">{[["month", "Mes"], ["week", "Semana"], ["year", "Año"]].map(([key, label]) => <button key={key} aria-pressed={view === key} className={view === key ? "active" : ""} onClick={() => onView(key)}>{label}</button>)}</div></div>
    <div className="calendar-frame"><button className="calendar-side-arrow previous" onClick={() => navigate(-1)} aria-label={periodLabel + " anterior"}><ChevronLeft size={31} /></button>
    <div className="calendar-swipe-viewport" tabIndex={0} role="group" aria-label={"Calendario. Desliza o usa las teclas izquierda y derecha para cambiar de " + periodLabel} {...swipe}>
    <div key={section + view + start} className={"calendar-body " + (motion > 0 ? "enter-next" : "enter-previous")}>
    {view === "month" && <MonthGrid year={date.getFullYear()} month={date.getMonth()} selected={day} getEntries={getEntries} onSelect={onDay} onEntry={onEntry} dragDate={dragDate} />}
    {view === "week" && <div className="week-calendar">{Array.from({ length: 7 }, (_, i) => {
      const key = addDays(start, i), doses = getEntries(key);
      return <div key={key} data-calendar-date={key} className={"week-day-card" + (key === day ? " selected" : "") + (key === today() ? " is-today" : "") + (dragDate === key ? " is-drop-target" : "")} onClick={() => onDay(key)}><button className="week-date" aria-label={dateLabel(key) + ", " + doses.length + " tomas"}><small>{new Intl.DateTimeFormat("es-BO", { weekday: "short" }).format(new Date(key + "T12:00:00"))}</small><b>{Number(key.slice(-2))}</b></button><div className="week-pills">{doses.length ? doses.map((dose) => <CalendarEntry key={dose.id} dose={dose} detailed onOpen={onEntry} />) : <span className="week-empty">{section === "treatments" ? "Sin tomas previstas" : "Sin registros"}</span>}</div></div>;
    })}</div>}
    {view === "year" && <div className="year-calendar">{Array.from({ length: 12 }, (_, month) => <article className="year-month" key={month}><h3>{new Intl.DateTimeFormat("es-BO", { month: "long" }).format(new Date(date.getFullYear(), month, 1))}</h3><MonthGrid year={date.getFullYear()} month={month} selected={day} getEntries={getEntries} onSelect={onDay} onEntry={onEntry} dragDate={dragDate} compact /></article>)}</div>}
    </div></div><button className="calendar-side-arrow next" onClick={() => navigate(1)} aria-label={periodLabel + " siguiente"}><ChevronRight size={31} /></button></div>
    <div className="calendar-footer"><span><CheckCircle2 size={14} /><b>{saved.length}</b> {saved.length === 1 ? "toma registrada" : "tomas registradas"} en este periodo</span><span className="calendar-desktop-hint">Pulsa una pastilla para especificar su nombre</span><span className="calendar-swipe-hint">Desliza para cambiar de {periodLabel}</span></div>
  </section>;
}
function DoseRow({ dose, records, onTake, onDelete, onName }) {
  const previous = isNamedMedicine(dose.medicine) && dose.takenAt && records.filter((item) => item.id !== dose.id && item.takenAt && item.takenAt < dose.takenAt && norm(item.medicine) === norm(dose.medicine)).sort((a, b) => b.takenAt - a.takenAt)[0];
  const delta = dose.plannedTime && dose.takenAt ? dose.takenAt - atTime(dose.date, dose.plannedTime) : null;
  return <article className="dose-row"><Med name={dose.medicine} /><div className="dose-copy">{!dose.isVirtual && onName ? <button className="dose-name-button" onClick={() => onName(dose)}><span>{medicineLabel(dose.medicine)}</span><Pencil size={13} /></button> : <h3>{medicineLabel(dose.medicine)}</h3>}<span className={"dose-status " + (dose.status === "taken" ? "taken" : "")}>
    {dose.status === "taken" ? <><CheckCircle2 size={13} />Tomada{dose.takenAt ? " · " + timeLabel(dose.takenAt, true) : " · Hora no registrada"}</> : <><Clock3 size={13} />Programada · {dose.plannedTime}</>}
  </span>{dose.legacy && <small>Registro del calendario anterior</small>}{delta !== null && <small>Prevista {dose.plannedTime} · {delta === 0 ? "A tiempo" : durationLabel(delta) + (delta < 0 ? " antes" : " después")}</small>}{previous && <small>{durationLabel(dose.takenAt - previous.takenAt)} desde la toma anterior</small>}</div>
    <div className="dose-actions">{dose.status !== "taken" ? <button className="take-button" disabled={dose.date > today()} onClick={() => onTake(dose)}><Check size={16} /><span>Tomada</span></button> : <button className="icon-button delete-button" onClick={() => onDelete(dose)} aria-label={"Eliminar registro de " + medicineLabel(dose.medicine)}><Trash2 size={16} /></button>}</div>
  </article>;
}
function ReportModal({ day, view, records, name, onClose }) {
  const [anchor, setAnchor] = useState(day), [period, setPeriod] = useState(view), [scope, setScope] = useState("all");
  const [start, end] = rangeFor(anchor, period);
  const list = records.filter((item) => item.status === "taken" && item.date >= start && item.date <= end && (scope === "all" || (scope === "treatments" ? !!item.planId : !item.planId))).sort((a, b) => a.date.localeCompare(b.date) || (a.takenAt || 0) - (b.takenAt || 0));
  const totals = new Map(); list.forEach((item) => { const label = medicineLabel(item.medicine), key = norm(label), previous = totals.get(key) || { name: label, count: 0, days: new Set() }; previous.count++; previous.days.add(item.date); totals.set(key, previous); });
  const identified = [...totals.values()].filter((item) => isNamedMedicine(item.name)).length;
  return <Modal title="Informe de seguimiento" sub="PARA TI Y TU MÉDICO" wide report onClose={onClose}>
    <div className="report-controls"><label className="field-label">Periodo<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="week">Semana</option><option value="month">Mes</option><option value="year">Año</option></select></label><label className="field-label">{period === "month" ? "Mes del informe" : "Fecha de referencia"}<input type={period === "month" ? "month" : "date"} value={period === "month" ? anchor.slice(0, 7) : anchor} onChange={(event) => event.target.value && setAnchor(period === "month" ? event.target.value + "-01" : event.target.value)} /></label><label className="field-label">Registros<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">Todas las tomas</option><option value="records">Uso ocasional</option><option value="treatments">Tratamientos</option></select></label></div>
    <div className="report-content"><div className="report-title"><span className="eyebrow">PASTILLAS · REGISTRO PERSONAL</span><h2>{name ? "Seguimiento de " + name : "Seguimiento de medicamentos"}</h2><p>{period === "month" ? monthTitle(anchor) + " · " : ""}{dateLabel(start, true)} — {dateLabel(end, true)}</p><p className="report-scope">{scope === "all" ? "Todas las tomas" : scope === "treatments" ? "Tratamientos" : "Uso ocasional"}</p></div><div className="report-summary"><b>{list.length} tomas</b><span>{new Set(list.map((item) => item.date)).size} días con registros</span><span>{identified} medicamentos identificados</span></div>
      {!!list.length && <><h3 className="report-section-title">Resumen por pastilla</h3><div className="report-table-wrap"><table className="report-table report-statistics"><caption className="sr-only">Estadísticas de consumo del periodo seleccionado</caption><thead><tr><th scope="col">Medicamento</th><th scope="col">Tomas</th><th scope="col">Días con toma</th><th scope="col">% del total</th></tr></thead><tbody>{[...totals.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")).map((item) => <tr key={norm(item.name)}><th scope="row">{item.name}</th><td>{item.count}</td><td>{item.days.size}</td><td>{new Intl.NumberFormat("es-BO", { style: "percent", maximumFractionDigits: 1 }).format(item.count / list.length)}</td></tr>)}</tbody></table></div></>}
      {list.length ? <><h3 className="report-section-title">Detalle de tomas</h3><div className="report-table-wrap"><table className="report-table"><caption className="sr-only">Registros de cada toma del periodo seleccionado</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Medicamento</th><th scope="col">Hora de toma</th><th scope="col">Tipo</th></tr></thead><tbody>{list.map((item) => <tr key={item.id}><td>{dateLabel(item.date, true)}</td><td>{medicineLabel(item.medicine)}</td><td>{item.takenAt ? timeLabel(item.takenAt, true) : "No registrada"}</td><td>{item.legacy ? "Histórico" : item.planId ? "Tratamiento" : "Ocasional"}</td></tr>)}</tbody></table></div></> : <div className="empty-state"><FileText size={25} /><b>No hay tomas en este periodo</b><p>Elige otro mes, semana o año para consultar el historial.</p></div>}
      {list.some((item) => item.legacy) && <p className="report-note">Los registros históricos conservan su fecha original. Los nombres pueden haberse completado después; las horas ausentes se indican como no registradas.</p>}
    </div>
    <button className="primary-button full-button report-action" disabled={!list.length} onClick={() => window.print()}><Printer size={18} />Imprimir o guardar PDF</button>
  </Modal>;
}

export default function App() {
  const journal = useJournal();
  const { records, plans, name, reminders, sync, cloudError } = journal;
  const [section, setSection] = useState("records"), [day, setDay] = useState(today), [view, setView] = useState("month"), [modal, setModal] = useState(journal.name ? "" : "name-entry"), [selected, setSelected] = useState(null), [returnTo, setReturnTo] = useState(""), [toast, setToast] = useState("");
  const [initialMedicine, setInitialMedicine] = useState(""), [nameReturnTo, setNameReturnTo] = useState(""), [dragDate, setDragDate] = useState(null);
  const [dropQuick, setDropQuick] = useState(false), [deleteReturnTo, setDeleteReturnTo] = useState("day");
  const registrations = usePendingRegistrations((data, scope) => { journal.saveRecord(data, scope); setToast(medicineLabel(data.medicine) + " · Toma guardada"); }, (error) => setToast(error.message), journal.uid);
  const startupShown = useRef(false), automaticNamePrompt = useRef(!journal.name), historyOpened = useRef(null);
  const frequent = useMemo(() => frequentMedicines(records), [records]);
  const suggestions = useMemo(() => {
    const names = new Map(); [...records, ...plans].forEach((item) => { if (isNamedMedicine(item.medicine)) names.set(norm(item.medicine), item.medicine); }); return [...names.values()].sort((a, b) => a.localeCompare(b, "es"));
  }, [records, plans]);
  const doses = entriesFor(day, section, records, plans), activePlans = plans.filter((plan) => plan.active);
  const remainingToday = entriesFor(today(), "treatments", records, plans).filter((dose) => dose.status !== "taken");
  const legacy = records.filter((item) => item.legacy), latestLegacy = legacy.map((item) => item.date).sort().at(-1);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((value) => value[0]?.toUpperCase()).join("") || "T";
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 4200); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (journal.profileId && automaticNamePrompt.current) { automaticNamePrompt.current = false; setModal((current) => current === "name-entry" ? "" : current); }
  }, [journal.profileId]);
  useEffect(() => {
    if (!journal.profileId || journal.loadedCloudRecords === null || historyOpened.current === journal.profileId) return;
    historyOpened.current = journal.profileId;
    const latest = records.filter((item) => item.status === "taken").map((item) => item.date).sort().at(-1);
    if (latest && day === today() && view === "month" && !records.some((item) => item.date.startsWith(today().slice(0, 7)))) setDay(latest);
  }, [journal.profileId, journal.loadedCloudRecords, records, day, view]);
  useEffect(() => {
    if (!startupShown.current && plans.length) { startupShown.current = true; if (reminders && remainingToday.length) setModal((current) => current || "reminder"); }
  }, [plans.length, reminders, remainingToday.length]);
  useEffect(() => {
    if (!reminders || !("Notification" in window) || Notification.permission !== "granted") return;
    const timers = [];
    plans.filter((plan) => isDue(plan, today())).forEach((plan) => {
      const taken = records.some((item) => item.planId === plan.id && item.date === today() && item.status === "taken"), due = atTime(today(), plan.time);
      if (!taken && due > Date.now()) timers.push(setTimeout(async () => {
        try { const registration = await navigator.serviceWorker?.getRegistration(); if (registration?.showNotification) await registration.showNotification("Hora de tu medicamento", { body: plan.medicine + " · " + plan.time, icon: "./icon-192.png", tag: plan.id + "-" + today() }); else new Notification("Hora de tu medicamento", { body: plan.medicine + " · " + plan.time, icon: "./icon-192.png" }); } catch {}
      }, due - Date.now()));
    });
    return () => timers.forEach(clearTimeout);
  }, [plans, records, reminders, permission]);
  function openDay(date) { setDay(date); setModal("day"); }
  function openQuick(from = "", medicine = "", date = day, fromDrop = false) { setDay(date > today() ? today() : date); setInitialMedicine(medicine); setDropQuick(fromDrop); setReturnTo(from); setModal("quick-log"); }
  function openEntry(dose, from = "") { setDay(dose.date); if (dose.isVirtual) { setModal("day"); return; } setSelected(dose); setNameReturnTo(from); setModal("name-medicine"); }
  function openDelete(record, from = "day") { setSelected(record); setDeleteReturnTo(from); setModal("delete"); }
  function deleteSelected() {
    try { journal.removeRecord(selected); setSelected(null); setModal(deleteReturnTo === "name-medicine" ? nameReturnTo : deleteReturnTo); setToast("Toma eliminada"); }
    catch (error) { setToast(error.message); }
  }
  function renameMedicine(recordId, medicine) { const updated = journal.renameRecord(recordId, medicine); setSelected(updated); setModal(nameReturnTo); setToast(medicine.trim() ? "Nombre de la pastilla guardado" : "Toma conservada sin especificar"); }
  function queueDrop(data) { registrations.queue(data); setDay(data.date); setModal(""); }
  function dropMedicine(medicine, date) {
    setDragDate(null);
    if (date > today()) return;
    if (date < today()) { openQuick("", medicine, date, true); return; }
    queueDrop({ medicine, date, status: "taken", takenAt: Date.now(), plannedTime: null });
  }
  function changeSection(next) { setSection(next); setModal(""); }
  function changeName() { automaticNamePrompt.current = false; setModal("name-entry"); }
  async function enterProfile(value) {
    registrations.cancelAll();
    const openedName = await journal.enterName(value);
    startupShown.current = false; historyOpened.current = null; setSelected(null); setDragDate(null);
    setDay(today()); setView("month"); setSection("records"); setModal(""); setToast("Historial de " + openedName);
  }
  function shift(direction) { setDay((current) => view === "year" ? addMonths(current, direction * 12) : view === "week" ? addDays(current, direction * 7) : addMonths(current, direction)); }
  function saveLog(data) { journal.saveRecord(data); setDay(data.date); setSection("records"); setModal(""); setToast(medicineLabel(data.medicine) + " · Toma guardada"); }
  function takeDose(dose) { try { journal.takeDose(dose); setToast(dose.medicine + " · Toma guardada"); } catch (err) { setToast(err.message); } }
  function savePlan(plan) { journal.savePlan(plan); setDay(plan.startDate); setSection("treatments"); setModal(""); setToast("Tratamiento programado"); }
  const isTreatment = section === "treatments";
  return <div className="app-shell">
    <aside className="desktop-sidebar"><a className="brand" href="./"><span className="brand-icon"><Activity size={22} /></span><span>pastillas<span className="brand-dot">.</span><small>MI REGISTRO PERSONAL</small></span></a><div className="side-label">MIS CALENDARIOS</div>
      <button className={"side-link" + (!isTreatment ? " active" : "")} aria-current={!isTreatment ? "page" : undefined} onClick={() => changeSection("records")}><CalendarDays size={19} />Mis tomas</button><button className={"side-link" + (isTreatment ? " active" : "")} aria-current={isTreatment ? "page" : undefined} onClick={() => changeSection("treatments")}><Repeat2 size={19} />Tratamientos{activePlans.length > 0 && <span className="nav-count">{activePlans.length}</span>}</button>
      <div className="side-label side-label-secondary">SEGUIMIENTO</div><button className="side-link" onClick={() => setModal("report")}><FileText size={19} />Informe para el médico</button>
      <div className="sidebar-bottom"><div className="sidebar-note"><ShieldCheck size={20} /><p>Un día a la vez.<br /><span>Tu historial siempre a mano.</span></p></div><button className="profile-button" onClick={() => setModal("profile")}><span className="avatar">{initials}</span><span className="profile-copy"><b>{name || "Tu perfil"}</b><small>Perfil y recordatorios</small></span><Settings2 size={17} /></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="mobile-brand"><span className="brand-icon"><Activity size={19} /></span><b>pastillas<span className="brand-dot">.</span></b></div><button className="sync-indicator" onClick={() => setModal("profile")} aria-label="Ver sincronización y perfil" title={cloudError || "Tus registros se guardan también en este navegador."}>{sync === "connecting" || sync === "syncing" ? <LoaderCircle size={13} className="spinner" /> : <span className={"sync-dot" + (sync === "online" ? " is-online" : "")} />}<span>{sync === "online" ? "Sincronizado" : sync === "syncing" || sync === "connecting" ? "Conectando" : "En este dispositivo"}</span></button><button className="icon-button mobile-report" aria-label="Informe de seguimiento" onClick={() => setModal("report")}><FileText size={20} /></button><button className="avatar top-avatar" onClick={() => setModal("profile")} aria-label="Perfil y recordatorios">{initials}</button></header>
      <div className="calendar-content"><section className="page-heading"><div><p className="eyebrow">{isTreatment ? "TU RUTINA, ORGANIZADA" : "TU HISTORIAL PERSONAL"}</p><h1>{isTreatment ? "Tratamientos" : "Mis tomas"}<span className="heading-spark">✦</span></h1><p>{isTreatment ? "Medicación programada y seguimiento de tus recetas." : "Pastillas de uso ocasional y tus registros anteriores."}</p></div><div className="heading-actions">{isTreatment && <button className="secondary-button manage-button" onClick={() => setModal("plans")}><Settings2 size={17} /><span>Administrar</span></button>}<button className="primary-button desktop-action" onClick={() => isTreatment ? setModal("plan") : openQuick()}><Plus size={18} />{isTreatment ? "Programar" : "Registrar toma"}</button></div></section>
        {cloudError && <div className="sync-problem" role="status"><div><b>No se pudo cargar o sincronizar el historial</b><p>{cloudErrorMessage(cloudError)}</p></div><button className="text-button" onClick={() => setModal("profile")}>Revisar</button></div>}
        {!cloudError && journal.profileId && journal.loadedCloudRecords === null && <p className="calendar-loading" role="status"><LoaderCircle size={16} className="spinner" />Cargando el historial de {name}…</p>}
        {!!journal.savedHistories.length && <div className="sync-problem"><div><b>Hay un historial anterior en este navegador</b><p>Puedes recuperar su copia desde tu perfil.</p></div><button className="text-button" onClick={() => setModal("profile")}>Ver copia</button></div>}
        {!isTreatment && <MedicineCatalog medicines={frequent} onPick={(medicine) => openQuick("", medicine)} onDrop={dropMedicine} onHoverDate={setDragDate} />}
        <CalendarPanel day={day} view={view} section={section} records={records} plans={plans} onDay={openDay} onEntry={openEntry} onToday={() => setDay(today())} onView={setView} onShift={shift} dragDate={dragDate} />
        {!isTreatment && legacy.length > 0 && <button className="history-link" onClick={() => { setDay(latestLegacy); setView("month"); }}><Clock3 size={15} /><span>{legacy.length} {legacy.length === 1 ? "registro anterior conservado" : "registros anteriores conservados"}</span><span>Ver último mes<ChevronRight size={14} /></span></button>}
        {isTreatment && plans.length === 0 && <p className="calendar-guidance">Pulsa + para crear tu primer tratamiento. Sus tomas aparecerán aquí en las fechas programadas.</p>}
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Secciones principales"><button className={"mobile-nav-link" + (!isTreatment ? " active" : "")} aria-current={!isTreatment ? "page" : undefined} onClick={() => changeSection("records")}><CalendarDays size={21} /><span>Mis tomas</span></button><button className="mobile-add" onClick={() => isTreatment ? setModal("plan") : openQuick()} aria-label={isTreatment ? "Programar tratamiento" : "Registrar toma"}><Plus size={25} /></button><button className={"mobile-nav-link" + (isTreatment ? " active" : "")} aria-current={isTreatment ? "page" : undefined} onClick={() => changeSection("treatments")}><Repeat2 size={21} /><span>Tratamientos</span></button></nav>
    {toast && <div className={"toast" + (registrations.pending.length ? " toast-top" : "")} role="status"><CheckCircle2 size={18} /><span>{toast}</span><button onClick={() => setToast("")} aria-label="Cerrar aviso"><X size={16} /></button></div>}
    {!!registrations.pending.length && <section className="pending-registrations" aria-label="Registros pendientes">{registrations.pending.map((item) => <div className="pending-registration" key={item.id}><Med name={item.data.medicine} small /><div className="pending-registration-copy" role="status"><b>{medicineLabel(item.data.medicine)}</b><span>{dateLabel(item.data.date, true)} · {timeLabel(item.data.takenAt, true)}</span><small>Registro pendiente</small></div><button onClick={() => { if (registrations.cancel(item.id)) setToast("Registro anulado"); }} aria-label={"Anular registro de " + medicineLabel(item.data.medicine)}><X size={14} />Anular<span className="pending-count" aria-hidden="true">{item.seconds}</span></button></div>)}</section>}
    {modal === "day" && <Modal title={dateLabel(day)} sub={isTreatment ? "TRATAMIENTOS DEL DÍA" : "TOMAS DEL DÍA"} onClose={() => setModal("")}><div className="day-modal-list">{doses.length ? doses.map((dose) => <DoseRow key={dose.id} dose={dose} records={records} onTake={takeDose} onName={(dose) => openEntry(dose, "day")} onDelete={(item) => openDelete(item)} />) : <div className="empty-state"><CalendarDays size={27} /><b>{isTreatment ? "Sin tomas programadas" : "No hay tomas en esta fecha"}</b><p>{isTreatment ? "Los tratamientos aparecerán según su repetición." : day > today() ? "Aquí verás las pastillas que registres ese día." : "Si olvidaste registrar una pastilla, puedes añadirla aquí."}</p></div>}</div><button className="primary-button full-button" disabled={!isTreatment && day > today()} onClick={() => isTreatment ? setModal("plan") : openQuick("day")}><Plus size={18} />{isTreatment ? "Programar tratamiento" : "Registrar una toma en este día"}</button></Modal>}
    {modal === "quick-log" && <QuickLogModal date={day} frequent={frequent} suggestions={suggestions} initialMedicine={initialMedicine} delayed={dropQuick} onClose={() => setModal(returnTo)} onSave={dropQuick ? queueDrop : saveLog} />}
    {modal === "name-medicine" && selected && <NameMedicineModal record={selected} suggestions={suggestions} onClose={() => setModal(nameReturnTo)} onSave={renameMedicine} onDelete={(record) => openDelete(record, "name-medicine")} />}
    {modal === "plan" && <PlanModal date={day} suggestions={suggestions} onClose={() => setModal("")} onSave={savePlan} />}
    {modal === "plans" && <Modal title="Tus tratamientos" sub="ADMINISTRAR MEDICACIÓN" onClose={() => setModal("")}><div className="plan-list">{plans.length ? plans.map((plan) => <article className={"treatment-card" + (!plan.active ? " treatment-paused" : "")} key={plan.id}><Med name={plan.medicine} /><div className="treatment-copy"><b>{plan.medicine}</b><span>Cada {plan.interval} {plan.intervalUnit === "weeks" ? "semana(s)" : "día(s)"} · {plan.time}</span><small>{plan.active ? "Activo desde " + dateLabel(plan.startDate, true) : "Pausado"}</small></div><button className={"switch-button" + (plan.active ? " is-on" : "")} role="switch" aria-checked={plan.active} aria-label={(plan.active ? "Pausar " : "Activar ") + plan.medicine} onClick={() => journal.togglePlan(plan)}><span /></button></article>) : <div className="empty-state"><Repeat2 size={25} /><b>Aún no tienes tratamientos</b><p>Programa la medicación de tu receta para verla en su calendario.</p></div>}</div><button className="primary-button full-button" onClick={() => setModal("plan")}><Plus size={18} />Nuevo tratamiento</button></Modal>}
    {modal === "report" && <ReportModal day={day} view={view} records={records} name={name} onClose={() => setModal("")} />}
    {modal === "delete" && selected && <Modal title="¿Eliminar esta toma?" sub="CONFIRMAR CAMBIO" onClose={() => setModal(deleteReturnTo)}><div className="confirm-med"><Med name={selected.medicine} /><div><b>{medicineLabel(selected.medicine)}</b><span>{dateLabel(selected.date, true)} · {selected.takenAt ? timeLabel(selected.takenAt, true) : "Hora no registrada"}</span></div></div><p className="modal-copy">Se quitará esta toma de tu historial.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setModal(deleteReturnTo)}>Conservar</button><button className="danger-button" onClick={deleteSelected}><Trash2 size={16} />Eliminar</button></div></Modal>}
    {modal === "name-entry" && <NameEntryModal name={name} onClose={() => setModal("")} onEnter={enterProfile} />}
    {modal === "profile" && <ProfileModal journal={journal} initials={initials} permission={permission} onClose={() => setModal("")} onToast={setToast} onChangeName={changeName} onRecover={(history) => { if (history.latest) setDay(history.latest); setView("month"); setSection("records"); setModal(""); setToast("Copia local recuperada"); }} />}
    {modal === "reminder" && <Modal title="Tus tomas de hoy" sub="RECORDATORIO PERSONAL" onClose={() => setModal("")}><div className="reminder-intro"><Bell size={21} /><p>{remainingToday.length} {remainingToday.length === 1 ? "toma programada pendiente" : "tomas programadas pendientes"} para hoy.</p></div><div className="day-modal-list">{remainingToday.map((dose) => <DoseRow key={dose.id} dose={dose} records={records} onTake={takeDose} onDelete={() => {}} />)}</div><div className="modal-actions"><button className="text-button" onClick={() => { journal.changeReminders(false); setModal(""); }}>Desactivar avisos</button><button className="primary-button" onClick={() => { setSection("treatments"); setDay(today()); setModal(""); }}>Ver tratamientos</button></div></Modal>}
  </div>;
}
