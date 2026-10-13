import { useMemo, useState } from "react";
import { Activity, CalendarDays, Check, ChevronRight, Clock3, FileText, Pill } from "lucide-react";
import MedicineMark from "./MedicineMark";
import ReportRangePicker from "./ReportRangePicker";
import ReportPreview from "./ReportPreview";
import { dateLabel, rangeFor, today } from "./calendar";
import { activityBuckets, hasExactTime, medicineKey, medicineStats, reportModel, reportRecords } from "./reportData";
import { MEDICINE_COLORS, medicineMark } from "./medicineVisual";

function ActivityChart({ list, start, end }) {
  const buckets = activityBuckets(list, start, end), maximum = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return <section className="insight-card activity-card" aria-labelledby="activity-title"><div className="insight-card-heading"><div><span className="eyebrow">TU RITMO EN EL TIEMPO</span><h2 id="activity-title">Actividad de tomas</h2></div><span className="chart-scale">Máx. {maximum === 1 && !list.length ? 0 : maximum}</span></div>
    <div className="activity-chart" role="img" aria-label={`${list.length} tomas registradas desde ${dateLabel(start, true)} hasta ${dateLabel(end, true)}. Las barras muestran el número de tomas por intervalo.`}>{buckets.map((bucket) => <div key={bucket.start} title={`${dateLabel(bucket.start, true)}${bucket.end !== bucket.start ? " a " + dateLabel(bucket.end, true) : ""}: ${bucket.count} tomas`}><span style={{ height: (bucket.count ? Math.max(7, bucket.count / maximum * 100) : 3) + "%" }} className={bucket.count ? "has-takes" : ""} /></div>)}</div>
    <div className="activity-axis"><span>{dateLabel(start, true)}</span><span>{dateLabel(end, true)}</span></div><p className="insight-note">{!list.length ? "Cuando haya tomas en el rango, aparecerán aquí." : "Cada barra reúne las tomas de ese tramo. No indica dosis ni cantidad de comprimidos."}</p>
  </section>;
}

export default function ReportsPage({ records, name, day, Modal }) {
  const [range, setRange] = useState(() => { const [start, end] = rangeFor(day > today() ? today() : day, "month"); return { start, end: end > today() ? today() : end }; });
  const [scope, setScope] = useState("all"), [excluded, setExcluded] = useState(() => new Set()), [selectingEnd, setSelectingEnd] = useState(false), [preview, setPreview] = useState(null);
  const { start, end } = range;
  const periodRecords = useMemo(() => reportRecords(records, start, end, scope), [records, start, end, scope]);
  const groups = useMemo(() => medicineStats(periodRecords), [periodRecords]);
  const selected = useMemo(() => periodRecords.filter((record) => !excluded.has(medicineKey(record))), [periodRecords, excluded]);
  const selectedGroups = groups.filter((group) => !excluded.has(group.key)), days = new Set(selected.map((record) => record.date)).size;
  const unknownTimes = selected.filter((record) => !hasExactTime(record)).length;
  function toggle(key) { setExcluded((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; }); }
  function toggleAll() { const clear = selectedGroups.length === groups.length; setExcluded((current) => { const next = new Set(current); groups.forEach((group) => clear ? next.add(group.key) : next.delete(group.key)); return next; }); }
  function prepare() { if (!selected.length || selectingEnd) return; setPreview(reportModel({ records: selected, start, end, scope, name })); }

  return <div className="reports-page">
    <section className="page-heading report-page-heading"><div><p className="eyebrow">PARA TI Y TU MÉDICO</p><h1>Tu seguimiento<span className="heading-spark">✦</span></h1><p>Comprende tus tomas y elige qué compartir en tu próxima consulta.</p></div><span className="insight-heading-badge"><Activity size={16} />Tu historial, más claro</span></section>
    <div className="insight-summary" aria-label="Estadísticas de las pastillas seleccionadas"><article><span className="insight-stat-icon"><Pill size={21} /></span><div><b>{selected.length}</b><span>Tomas registradas</span></div></article><article><span className="insight-stat-icon"><CalendarDays size={21} /></span><div><b>{days}</b><span>Días con tomas</span></div></article><article><span className="insight-stat-icon"><Check size={21} /></span><div><b>{selectedGroups.length}</b><span>Pastillas seleccionadas</span></div></article></div>
    <div className="insight-layout">
      <ReportRangePicker range={range} onChange={setRange} records={records.filter((record) => record.status === "taken")} selectingEnd={selectingEnd} onSelectingEnd={setSelectingEnd} />
      <div className="insight-results"><ActivityChart list={selected} start={start} end={end} />
        <section className="insight-card medicine-stat-card" aria-labelledby="medicine-stats-title"><div className="insight-card-heading"><div><span className="eyebrow">02 · ELIGE LAS PASTILLAS</span><h2 id="medicine-stats-title">¿Qué quieres incluir?</h2></div><span className="selection-count">{selectedGroups.length}/{groups.length}</span></div>
          <div className="medicine-stat-controls"><div className="insight-scope" role="group" aria-label="Tipo de tomas">{[["all", "Todas"], ["records", "Ocasionales"], ["treatments", "Tratamientos"]].map(([key, label]) => <button key={key} aria-pressed={scope === key} className={scope === key ? "active" : ""} onClick={() => setScope(key)}>{label}</button>)}</div><button className="text-button" disabled={!groups.length} onClick={toggleAll}>{selectedGroups.length === groups.length && groups.length ? "Quitar selección" : "Elegir todas"}</button></div>
          {groups.length ? <div className="medicine-stat-table-wrap"><table className="medicine-stat-table"><caption className="sr-only">Estadísticas por pastilla. Marca las que quieras incluir en el informe.</caption><thead><tr><th scope="col">Pastilla</th><th scope="col">Tomas</th><th scope="col">Días</th><th scope="col" className="medicine-last-column">Última toma</th></tr></thead><tbody>{groups.map((group) => {
            const checked = !excluded.has(group.key), color = MEDICINE_COLORS[medicineMark(group.name).tone];
            return <tr key={group.key} className={checked ? "is-included" : "is-excluded"}><th scope="row"><label className="medicine-stat-choice"><input type="checkbox" checked={checked} onChange={() => toggle(group.key)} aria-label={"Incluir " + group.name + " en el informe"} /><MedicineMark name={group.name} /><span><b>{group.name}</b><span className="medicine-stat-frequency"><i style={{ width: Math.max(4, group.count / periodRecords.length * 100) + "%", background: color }} /></span><small>{Math.round(group.count / periodRecords.length * 100)}% de las tomas del periodo</small></span></label></th><td><b>{group.count}</b></td><td>{group.days.size}</td><td className="medicine-last-column">{dateLabel(group.last, true)}</td></tr>;
          })}</tbody></table></div> : <div className="insight-empty"><Pill size={29} /><h3>No hay tomas en estas fechas</h3><p>Elige otro rango o pulsa «Todo» para ver el historial disponible.</p></div>}
          {unknownTimes > 0 && <p className="insight-note historical-note"><Clock3 size={15} />{unknownTimes} {unknownTimes === 1 ? "registro sin hora" : "registros sin hora"}. Se conservan en el informe con su fecha original.</p>}
        </section>
      </div>
    </div>
    <div className="report-compose-bar"><span className="compose-icon"><FileText size={22} /></span><div><b>{selected.length} tomas · {selectedGroups.length} {selectedGroups.length === 1 ? "pastilla" : "pastillas"}</b><span>{selectingEnd ? "Elige una fecha final para continuar" : dateLabel(start, true) + " - " + dateLabel(end, true)}</span></div><button className="primary-button" disabled={!selected.length || selectingEnd} onClick={prepare}>Preparar informe<ChevronRight size={17} /></button></div>
    {preview && <ReportPreview model={preview} Modal={Modal} onClose={() => setPreview(null)} />}
  </div>;
}
