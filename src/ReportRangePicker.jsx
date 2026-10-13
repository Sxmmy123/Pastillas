import { useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, MoveHorizontal, RotateCcw } from "lucide-react";
import useCalendarSwipe from "./useCalendarSwipe";
import { addDays, addMonths, dateLabel, dayKey, daysBetween, monthTitle, rangeFor, today } from "./calendar";

export default function ReportRangePicker({ range, onChange, records, selectingEnd, onSelectingEnd }) {
  const { start, end } = range;
  const rangeDays = daysBetween(start, end) + 1;
  const [month, setMonth] = useState(start.slice(0, 7) + "-01"), [motion, setMotion] = useState(1), [animation, setAnimation] = useState(0);
  const [preset, setPreset] = useState(""), [editing, setEditing] = useState("start");
  const navigate = (direction) => { setMotion(direction); setMonth((value) => addMonths(value, direction)); };
  const swipe = useCalendarSwipe(navigate);
  const date = new Date(month + "T12:00:00"), year = date.getFullYear(), m = date.getMonth();
  const offset = (new Date(year, m, 1).getDay() + 6) % 7, total = new Date(year, m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + total) / 7) * 7 }, (_, i) => i >= offset && i < offset + total ? i - offset + 1 : 0);
  const markedDays = new Set(records.map((record) => record.date));
  const visibleStart = start > month ? start : month;
  const visibleEnd = end < dayKey(new Date(year, m + 1, 0)) ? end : dayKey(new Date(year, m + 1, 0));
  const visibleLength = Math.max(1, daysBetween(visibleStart, visibleEnd) + 1);
  const animate = () => setAnimation((value) => value + 1);

  function pick(key) {
    setPreset("");
    if (editing === "end" || selectingEnd) {
      onChange({ start: key < start ? key : start, end: key < start ? start : key });
      onSelectingEnd(false); setEditing("start");
    } else {
      onChange({ start: key, end: key }); onSelectingEnd(true); setEditing("end");
    }
    animate();
  }

  function choosePreset(key) {
    const current = today(); let next;
    if (key === "month") { const bounds = rangeFor(current, "month"); next = { start: bounds[0], end: current }; }
    else if (key === "last-month") { const bounds = rangeFor(addMonths(current, -1), "month"); next = { start: bounds[0], end: bounds[1] }; }
    else if (key === "30") next = { start: addDays(current, -29), end: current };
    else { const dates = records.map((record) => record.date).sort(); next = { start: dates[0] || current, end: dates.at(-1) || current }; }
    onChange(next); onSelectingEnd(false); setEditing("start"); setMonth(next.start.slice(0, 7) + "-01"); setPreset(key); animate();
  }

  function manual(boundary, value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today()) return;
    const next = boundary === "start" ? { start: value, end: value > end ? value : end } : { start: value < start ? value : start, end: value };
    onChange(next); onSelectingEnd(false); setEditing("start"); setMonth(value.slice(0, 7) + "-01"); setPreset(""); animate();
  }

  function jumpMonth(event) {
    const value = event.currentTarget.value;
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    setMotion(value > month.slice(0, 7) ? 1 : -1); setMonth(value + "-01");
  }

  return <section className="insight-card range-card" aria-labelledby="range-title">
    <div className="insight-card-heading"><div><span className="eyebrow">01 · ELIGE LAS FECHAS</span><h2 id="range-title">Tu recorrido</h2></div><span className="range-duration">{rangeDays} {rangeDays === 1 ? "día" : "días"}</span></div>
    <div className="range-presets" role="group" aria-label="Periodos rápidos">{[["month", "Este mes"], ["last-month", "Mes anterior"], ["30", "30 días"], ["all", "Todo"]].map(([key, label]) => <button key={key} aria-pressed={preset === key} className={preset === key ? "active" : ""} onClick={() => choosePreset(key)}>{label}</button>)}</div>
    <div className="range-boundaries">
      <button className={"range-boundary" + (editing === "start" && !selectingEnd ? " active" : "")} onClick={() => { setEditing("start"); onSelectingEnd(false); setMonth(start.slice(0, 7) + "-01"); }}><small>Desde</small><b>{dateLabel(start, true)}</b></button><ArrowRight size={16} aria-hidden="true" />
      <button className={"range-boundary" + (editing === "end" || selectingEnd ? " active" : "")} onClick={() => { setEditing("end"); onSelectingEnd(true); setMonth(end.slice(0, 7) + "-01"); }}><small>Hasta</small><b>{selectingEnd ? "Elige el final" : dateLabel(end, true)}</b></button>
    </div>
    <div className="range-month-nav"><button className="icon-button" onClick={() => navigate(-1)} aria-label="Mes anterior del rango"><ChevronLeft size={22} /></button><label className="range-month-jump"><span>{monthTitle(month)}</span><input type="month" value={month.slice(0, 7)} aria-label="Ir a un mes del selector de fechas" onInput={jumpMonth} onChange={jumpMonth} /></label><button className="icon-button" onClick={() => navigate(1)} aria-label="Mes siguiente del rango"><ChevronRight size={22} /></button></div>
    <div className="range-swipe" {...swipe} tabIndex={0} role="group" aria-label="Calendario de rango. Desliza para cambiar de mes.">
      <div className={"range-calendar " + (motion > 0 ? "enter-next" : "enter-previous")} key={month}>
        {["L", "M", "M", "J", "V", "S", "D"].map((label, i) => <span className="range-weekday" key={i}>{label}</span>)}
        {cells.map((n, i) => {
          if (!n) return <span key={"empty" + i} />;
          const key = month.slice(0, 7) + "-" + String(n).padStart(2, "0"), included = key >= start && key <= end, first = key === start, last = key === end;
          const delay = Math.max(0, daysBetween(visibleStart, key)) * (550 / visibleLength);
          return <button key={key} disabled={key > today()} aria-pressed={included} aria-label={dateLabel(key) + (first ? ", inicio" : last ? ", final" : included ? ", dentro del rango" : "") + (markedDays.has(key) ? ", con tomas" : "")} className={"range-day" + (included ? " in-range" : "") + (first ? " range-start" : "") + (last ? " range-end" : "") + (key === today() ? " range-today" : "") + (i % 7 === 0 ? " row-start" : "") + (i % 7 === 6 ? " row-end" : "") + (animation ? " range-animate " + (animation % 2 ? "range-flow-a" : "range-flow-b") : "")} style={{ "--range-delay": delay + "ms" }} onClick={() => pick(key)}><span>{n}</span>{markedDays.has(key) && <i className="range-take-dot" />}{last && animation > 0 && <i key={animation} className="range-impact" aria-hidden="true" />}</button>;
        })}
      </div>
    </div>
    <p className={"range-instruction" + (selectingEnd ? " choosing" : "")} role="status">{selectingEnd ? <><MoveHorizontal size={15} />Desliza de mes y toca la fecha final.</> : <><Check size={15} />Toca el inicio y después el final.</>}</p>
    <details className="range-manual"><summary>Escribir fechas</summary><div><label className="field-label">Desde<input type="date" value={start} max={today()} onInput={(event) => manual("start", event.currentTarget.value)} onChange={(event) => manual("start", event.target.value)} /></label><label className="field-label">Hasta<input type="date" value={end} max={today()} onInput={(event) => manual("end", event.currentTarget.value)} onChange={(event) => manual("end", event.target.value)} /></label></div></details>
    {selectingEnd && <button className="text-button" onClick={() => { onSelectingEnd(false); setEditing("start"); }}><Check size={14} />Usar solo este día</button>}
    {!selectingEnd && <button className="text-button range-restart" onClick={() => { setEditing("start"); onSelectingEnd(false); setPreset(""); setMonth(start.slice(0, 7) + "-01"); }}><RotateCcw size={13} />Elegir otro recorrido</button>}
  </section>;
}
