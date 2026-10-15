import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Moon, PackagePlus, Pill, Plus, Repeat2, ShoppingBag, Sun } from "lucide-react";
import Med from "./MedicineMark";
import { makeId } from "./storage";
import { addDays, atTime, dateLabel, today } from "./calendar";
import { isOvernight, isStockPlan, makeRefillBatch, stockState, treatmentPreview, treatmentSummary, validateStockPlan } from "./treatments";

export function SchedulePreview({ plan }) {
  const preview = useMemo(() => { try { validateStockPlan(plan); return treatmentPreview(plan); } catch { return null; } }, [plan]);
  if (!preview) return <p className="hint">Completa cantidad y horario para ver cuándo tomarías cada pastilla.</p>;
  return <section className="treatment-preview" aria-label="Vista previa del horario">
    <div className="treatment-preview-heading"><b>Así quedarían tus tomas</b><span>{preview.totalDoses} {preview.totalDoses === 1 ? "toma" : "tomas"}</span></div>
    <ol className="treatment-timeline">{preview.first.map((dose, index) => <li key={dose.id}><span className={"timeline-clock" + (isOvernight(dose.plannedTime) ? " overnight" : "")}>{Number(dose.plannedTime.slice(0, 2)) >= 18 || Number(dose.plannedTime.slice(0, 2)) < 6 ? <Moon size={14} /> : <Sun size={14} />}</span><b>{dose.plannedTime}</b><small>{dateLabel(dose.date, true)}</small>{index < preview.first.length - 1 && <ArrowRight className="timeline-arrow" size={12} />}</li>)}</ol>
    {preview.totalDoses > preview.first.length && <p className="hint">Primeras {preview.first.length} tomas. Las demás aparecerán en el calendario.</p>}
    {preview.last && <p className="treatment-last-dose"><Check size={15} /><span>Última toma: <b>{dateLabel(preview.last.date, true)} · {preview.last.plannedTime}</b></span></p>}
    {preview.overnightCount > 0 && <div className="overnight-notice" role="status"><Moon size={17} /><p><b>Incluye {preview.overnightCount} {preview.overnightCount === 1 ? "toma de madrugada" : "tomas de madrugada"}.</b><span>La primera: {dateLabel(preview.firstOvernight.date, true)} a las {preview.firstOvernight.plannedTime}. Revisa la hora inicial según tu indicación. El intervalo no omite la noche.</span></p></div>}
    {stockState(plan).loose > 0 && <p className="hint">Quedarán {stockState(plan).loose} pastillas sin completar otra toma. Se conservarán al añadir más.</p>}
  </section>;
}

export function PlanModal({ date, suggestions, Modal, previous, onClose, onSave }) {
  const currentDay = today(), tomorrow = addDays(currentDay, 1), initialDate = !date || date < currentDay ? currentDay : date;
  const [medicine, setMedicine] = useState(previous?.medicine || ""), [startDate, setStartDate] = useState(initialDate);
  const [mode, setMode] = useState("hours"), [time, setTime] = useState("08:00"), [morningTime, setMorningTime] = useState("08:00"), [nightTime, setNightTime] = useState("22:00");
  const [intervalHours, setIntervalHours] = useState("8"), [quantity, setQuantity] = useState(""), [pillsPerDose, setPillsPerDose] = useState("1"), [error, setError] = useState("");
  const [customHours, setCustomHours] = useState(false), [customDate, setCustomDate] = useState(initialDate !== currentDay && initialDate !== tomorrow);
  const [changingQuantity, setChangingQuantity] = useState(false);
  const [ids] = useState(() => ({ plan: makeId(), batch: makeId() }));
  const initialTime = mode === "day-night" ? morningTime : time;
  const draft = useMemo(() => ({ id: ids.plan, medicine: medicine.trim() || "Tu pastilla", scheduleVersion: 2, mode, startDate, time: initialTime,
    morningTime, nightTime, intervalHours: Number(intervalHours), pillsPerDose: Number(pillsPerDose), active: true,
    batches: [{ id: ids.batch, quantity: Number(quantity), startDate, startTime: initialTime, startAt: atTime(startDate, initialTime) }] }), [ids, medicine, mode, startDate, initialTime, morningTime, nightTime, intervalHours, pillsPerDose, quantity]);
  const startsOn = startDate === currentDay ? "hoy" : startDate === tomorrow ? "mañana" : startDate ? "el " + dateLabel(startDate, true) : "la fecha que elijas";
  function chooseMode(next) { setMode(next); setError(""); }
  function chooseDay(next) { setStartDate(next); setCustomDate(false); setError(""); }
  function submit(event) {
    event.preventDefault();
    try {
      if (!medicine.trim()) throw new Error("Escribe el nombre de la pastilla.");
      validateStockPlan(draft); const now = Date.now();
      onSave({ ...draft, medicine: medicine.trim(), createdAt: now, updatedAt: now }, previous?.id);
    } catch (cause) { if (!Number.isInteger(Number(pillsPerDose)) || Number(pillsPerDose) < 1 || Number(pillsPerDose) > 20) setChangingQuantity(true); setError(cause.message); }
  }
  return <Modal title={previous ? "Organizar por cantidad" : "Nuevo tratamiento"} sub="TUS PASTILLAS, A SU HORA" onClose={onClose} wide>
    <form className="form-stack treatment-form" onSubmit={submit}>
      {previous && <p className="hint">El historial del tratamiento anterior se conserva. Su horario se pausará al guardar este nuevo tratamiento.</p>}
      <label className="field-label"><span><i className="treatment-step-number">1</i>Nombre de la pastilla</span><input autoFocus value={medicine} list="treatment-medicines" onChange={(event) => setMedicine(event.target.value)} placeholder="Ej. Cortypiren" maxLength={70} required /></label>
      <datalist id="treatment-medicines">{suggestions.map((name) => <option key={name} value={name} />)}</datalist>
      <label className="field-label"><span><i className="treatment-step-number">2</i>¿Cuántas pastillas tienes?</span><input type="number" inputMode="numeric" min="1" max="9999" step="1" placeholder="Ej. 20" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-describedby="treatment-total-help" required /><small id="treatment-total-help" className="treatment-field-help">El total que tienes para este tratamiento.</small></label>
      <fieldset className="treatment-mode-field"><legend><i className="treatment-step-number">3</i>¿Cada cuánto la tomarás?</legend>
        <div className="treatment-modes">{[["hours", Clock3, "Cada ciertas horas"], ["daily", CalendarDays, "Cada día"]].map(([key, Icon, label]) => {
          const selected = key === "hours" ? mode === "hours" : mode !== "hours";
          return <button key={key} type="button" aria-pressed={selected} className={selected ? "active" : ""} onClick={() => chooseMode(key)}><Icon size={20} /><span>{label}</span>{selected && <Check size={14} />}</button>;
        })}</div>
        {mode === "hours" ? <div className="hours-picker"><div role="group" aria-label="Cada cuántas horas">{[6, 8, 10, 12].map((hours) => <button type="button" key={hours} aria-pressed={!customHours && Number(intervalHours) === hours} className={!customHours && Number(intervalHours) === hours ? "active" : ""} onClick={() => { setIntervalHours(String(hours)); setCustomHours(false); }}>{hours} horas</button>)}</div><button type="button" className="hours-custom-toggle" aria-expanded={customHours} aria-controls="treatment-custom-hours" onClick={() => setCustomHours(!customHours)}>Elegir otras horas<ChevronDown size={14} /></button>{customHours && <label id="treatment-custom-hours" className="field-label">¿Cada cuántas horas?<input type="number" inputMode="numeric" min="1" max="168" step="1" value={intervalHours} onChange={(event) => setIntervalHours(event.target.value)} required /></label>}</div> : <div className="daily-options" role="group" aria-label="Veces al día"><button type="button" aria-pressed={mode === "daily"} className={mode === "daily" ? "active" : ""} onClick={() => chooseMode("daily")}>Una vez al día</button><button type="button" aria-pressed={mode === "day-night"} className={mode === "day-night" ? "active" : ""} onClick={() => chooseMode("day-night")}><Sun size={14} /><Moon size={14} />Mañana y noche</button></div>}
      </fieldset>
      <fieldset className="treatment-mode-field treatment-start-field"><legend><i className="treatment-step-number">4</i>Empezar a tomar desde</legend>
        <div className="treatment-day-options" role="group" aria-label="Día de inicio"><button type="button" aria-pressed={!customDate && startDate === currentDay} className={!customDate && startDate === currentDay ? "active" : ""} onClick={() => chooseDay(currentDay)}>Hoy</button><button type="button" aria-pressed={!customDate && startDate === tomorrow} className={!customDate && startDate === tomorrow ? "active" : ""} onClick={() => chooseDay(tomorrow)}>Mañana</button><button type="button" aria-pressed={customDate} className={customDate ? "active" : ""} onClick={() => setCustomDate(true)}><CalendarDays size={15} />Otra fecha</button></div>
        {customDate && <label className="field-label treatment-date-input">Fecha de inicio<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>}
        {mode === "day-night" ? <div className="day-night-times"><label className="field-label"><span><Sun size={18} />Por la mañana</span><input type="time" value={morningTime} onChange={(event) => setMorningTime(event.target.value)} required /></label><label className="field-label"><span><Moon size={18} />Por la noche</span><input type="time" value={nightTime} onChange={(event) => setNightTime(event.target.value)} required /></label></div> : <label className="field-label treatment-time-input"><span><Clock3 size={15} />A las</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>}
        {startDate && initialTime && <p className="treatment-start-summary" aria-live="polite">Empiezas <b>{startsOn} a las {initialTime}</b>. {mode === "hours" ? `Después, cada ${intervalHours || "…"} horas.` : mode === "day-night" ? `Se repite cada mañana a las ${morningTime} y cada noche a las ${nightTime}.` : "Se repite cada día a esa hora."}</p>}
      </fieldset>
      <div className="treatment-dose-option"><button type="button" className="treatment-dose-toggle" aria-expanded={changingQuantity} aria-controls="treatment-each-quantity" onClick={() => setChangingQuantity(!changingQuantity)}><Pill size={16} /><span>Tomar <b>{pillsPerDose || "…"} {Number(pillsPerDose) === 1 ? "pastilla" : "pastillas"}</b> cada vez</span><small>Cambiar</small><ChevronDown size={15} /></button>{changingQuantity && <label id="treatment-each-quantity" className="field-label">¿Cuántas pastillas tomas cada vez?<input type="number" inputMode="numeric" min="1" max="20" step="1" value={pillsPerDose} onChange={(event) => setPillsPerDose(event.target.value)} aria-describedby="treatment-each-help" required /><small id="treatment-each-help" className="treatment-field-help">Si tomas 2 pastillas juntas a la misma hora, escribe 2.</small></label>}</div>
      <SchedulePreview plan={draft} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-button"><Check size={18} />Guardar tratamiento</button>
    </form>
  </Modal>;
}

export function TreatmentStockStrip({ plans, records, onManage, onRefill }) {
  const available = plans.filter((plan) => isStockPlan(plan) && plan.active);
  if (!available.length) return null;
  return <section className="treatment-stock-strip" aria-label="Pastillas de tus tratamientos">{available.map((plan) => {
    const stock = stockState(plan, records);
    return <article className={"stock-mini-card" + (stock.remaining <= 2 ? " low" : "")} key={plan.id}><button onClick={onManage}><Med name={plan.medicine} small /><span><b>{plan.medicine}</b><small>{stock.remaining ? `${stock.remaining} pastillas disponibles` : "Sin pastillas disponibles"}</small></span></button><button className="stock-mini-add" onClick={() => onRefill(plan)} aria-label={"Añadir pastillas de " + plan.medicine}><PackagePlus size={18} /></button></article>;
  })}</section>;
}

export function TreatmentManager({ plans, records, Modal, onClose, onNew, onToggle, onRefill, onConvert }) {
  const [error, setError] = useState("");
  return <Modal title="Tus tratamientos" sub="CANTIDAD Y HORARIOS" onClose={onClose} wide><div className="stock-plan-list">{plans.map((plan) => {
    const stock = isStockPlan(plan) ? stockState(plan, records) : null;
    return <article className={"stock-plan-card" + (!plan.active ? " paused" : "")} key={plan.id}>
      <div className="stock-plan-title"><Med name={plan.medicine} /><div><b>{plan.medicine}</b><span>{treatmentSummary(plan)}</span></div><button className={"switch-button" + (plan.active ? " is-on" : "")} role="switch" aria-checked={plan.active} aria-label={(plan.active ? "Pausar " : "Activar ") + plan.medicine} onClick={() => { try { onToggle(plan); setError(""); } catch (cause) { setError(cause.message); } }}><span /></button></div>
      {stock ? <><div className="stock-numbers"><span><b>{stock.remaining}</b> pastillas disponibles</span><small>{stock.consumed} registradas de {stock.purchased}</small></div><div className="stock-progress"><i style={{ width: Math.min(100, stock.consumed / stock.purchased * 100) + "%" }} /></div><p className="stock-plan-status">{!plan.active ? "En pausa" : stock.dosesLeft === 0 ? "Cantidad terminada" : `${stock.dosesLeft} tomas por registrar · ${plan.pillsPerDose} ${Number(plan.pillsPerDose) === 1 ? "pastilla" : "pastillas"} cada vez`}{plan.finishAfterBatch === stock.cycle && " · Termina al acabarlas"}</p>{stock.lastDose && <p className="stock-plan-end">Última prevista: {dateLabel(stock.lastDose.date, true)} · {stock.lastDose.plannedTime}</p>}
      {plan.pendingPurchase && <div className="pending-purchase"><ShoppingBag size={17} /><span>Compra prevista: <b>{plan.pendingPurchase.quantity} pastillas</b><small>Están previstas en el calendario. Confirma la compra para sumarlas a las disponibles.</small></span></div>}
      <button className="text-button" onClick={() => onRefill(plan)}><PackagePlus size={16} />{plan.pendingPurchase ? "Confirmar compra" : "Añadir más pastillas"}</button></> : <><p className="hint">Horario anterior conservado. Puedes continuar con una cantidad de pastillas.</p><button className="text-button" onClick={() => onConvert(plan)}><Pill size={15} />Configurar cantidad</button></>}
    </article>;
  })}{!plans.length && <div className="empty-state"><Repeat2 size={26} /><b>Aún no tienes tratamientos</b><p>Indica cuántas pastillas tienes y cómo debes tomarlas.</p></div>}</div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full-button" onClick={onNew}><Plus size={18} />Nuevo tratamiento</button></Modal>;
}

export function RefillModal({ plan, records, Modal, onClose, onDecline, onSave }) {
  const stock = stockState(plan, records), pending = plan.pendingPurchase;
  const [adding, setAdding] = useState(!!pending), [quantity, setQuantity] = useState(pending ? String(pending.quantity) : ""), [purchased, setPurchased] = useState(true), [error, setError] = useState("");
  const nextBatch = Number(quantity) > 0 ? makeRefillBatch(plan, Number(quantity), "preview") : null;
  const addedDoses = nextBatch ? Math.floor((stock.purchased + Number(quantity)) / plan.pillsPerDose) - Math.floor(stock.purchased / plan.pillsPerDose) : 0;
  function save(event) { event.preventDefault(); try { const count = Number(quantity); if (!Number.isInteger(count) || count < 1 || count > 9999) throw new Error("Indica entre 1 y 9999 pastillas."); onSave(plan.id, count, purchased); } catch (cause) { setError(cause.message); } }
  return <Modal title={adding ? "Añadir más pastillas" : stock.remaining <= 2 ? "Te quedan pocas pastillas" : "¿Continuar el tratamiento?"} sub="TÚ DECIDES CÓMO CONTINUAR" onClose={onClose}>
    <div className="confirm-med"><Med name={plan.medicine} /><div><b>{plan.medicine}</b><span>{stock.remaining} pastillas disponibles · {treatmentSummary(plan)}</span></div></div>
    {!adding ? <><p className="refill-question">¿Vas a comprar más pastillas para continuar con este horario?</p><button className="primary-button full-button" onClick={() => setAdding(true)}><PackagePlus size={18} />Sí, añadir pastillas</button><button className="secondary-button full-button" onClick={() => { try { onDecline(plan.id); } catch (cause) { setError(cause.message); } }}>No, terminar al acabarlas</button><button className="text-button full-button" onClick={onClose}>Decidir más tarde</button></> : <form className="form-stack" onSubmit={save}><label className="field-label">¿Cuántas pastillas añadirás?<input autoFocus type="number" inputMode="numeric" min="1" max="9999" step="1" placeholder="Ej. 10" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><div className="purchase-options" role="group" aria-label="Estado de la compra"><button type="button" aria-pressed={purchased} className={purchased ? "active" : ""} onClick={() => setPurchased(true)}><Check size={17} />Ya las tengo</button><button type="button" aria-pressed={!purchased} className={!purchased ? "active" : ""} onClick={() => setPurchased(false)}><ShoppingBag size={17} />Voy a comprarlas</button></div>
      {nextBatch && addedDoses > 0 && <div className="refill-next-dose"><Clock3 size={17} /><span>{addedDoses} nuevas tomas · La primera será<b>{dateLabel(nextBatch.startDate, true)} · {nextBatch.startTime}</b><small>Continúa después de la última toma del calendario. Si esa fecha ya pasó, se retoma desde la siguiente hora futura del mismo horario.</small></span></div>}
      {purchased && nextBatch && addedDoses === 0 && <p className="hint">Estas pastillas se sumarán a las disponibles, pero todavía no completan otra toma de {plan.pillsPerDose} pastillas.</p>}
      {!purchased && <p className="hint">El calendario se alargará con tomas «Por comprar». Confirma «Ya las tengo» para sumarlas a las disponibles y poder registrarlas como tomadas.</p>}
      <button className="primary-button full-button"><PackagePlus size={18} />{purchased ? addedDoses > 0 ? "Añadir y alargar calendario" : "Añadir a las disponibles" : "Guardar compra prevista"}</button>
      {pending && <button type="button" className="text-button full-button" onClick={() => { try { onDecline(plan.id); } catch (cause) { setError(cause.message); } }}>Cancelar compra prevista y terminar al acabarlas</button>}
    </form>}{error && <p className="form-error" role="alert">{error}</p>}
  </Modal>;
}

export function TreatmentTakeModal({ dose, Modal, onClose, onSave }) {
  const [time, setTime] = useState(""), [error, setError] = useState("");
  return <Modal title="¿A qué hora la tomaste?" sub="COMPLETAR UNA TOMA ANTERIOR" onClose={onClose}><div className="confirm-med"><Med name={dose.medicine} /><div><b>{dose.medicine}</b><span>{dateLabel(dose.date, true)} · prevista {dose.plannedTime}</span></div></div><form className="form-stack" onSubmit={(event) => { event.preventDefault(); try { const takenAt = atTime(dose.date, time); if (!time || !takenAt || takenAt > Date.now()) throw new Error("Indica la hora real de esa toma."); onSave(dose, takenAt); } catch (cause) { setError(cause.message); } }}><label className="field-label">Hora real de la toma<input autoFocus type="time" step="1" value={time} onChange={(event) => setTime(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full-button"><Check size={17} />Guardar toma</button></form></Modal>;
}
