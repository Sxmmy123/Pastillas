import { useEffect, useState } from "react";
import { ArrowLeft, Download, LoaderCircle, Printer, Share2 } from "lucide-react";
import MedicineMark from "./MedicineMark";
import { dateLabel, isNamedMedicine, medicineLabel } from "./calendar";
import { recordTime, recordType, scopeLabel } from "./reportData";

function download(file) {
  const url = URL.createObjectURL(file), link = document.createElement("a");
  link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function ReportPreview({ model, Modal, onClose }) {
  const [pdf, setPdf] = useState(null), [error, setError] = useState(""), [status, setStatus] = useState(""), [sharing, setSharing] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setPdf(null); setError("");
    Promise.all([import("./reportPdf.js"), import("./reportFonts.js").then((module) => module.loadReportFonts())]).then(([module, fonts]) => {
      if (!active) return;
      const built = module.createReportPdf(model, fonts);
      const file = new File([built.blob], built.filename, { type: "application/pdf" });
      setPdf({ file, pages: built.pages });
    }).catch(() => { if (active) setError("No se pudo preparar el PDF. Tus registros siguen guardados; puedes volver a intentarlo o imprimir el informe."); });
    return () => { active = false; };
  }, [model, retry]);
  let canShare = false;
  try { canShare = !!pdf && !!navigator.share && !!navigator.canShare?.({ files: [pdf.file] }); } catch {}

  async function share() {
    if (!pdf || sharing) return;
    setStatus(""); setSharing(true);
    try {
      await navigator.share({ files: [pdf.file], title: "Mi historial de pastillas", text: "Informe de tomas · " + model.rangeLabel });
      setStatus("PDF compartido.");
    } catch (cause) {
      if (cause.name !== "AbortError") setStatus("No se pudo abrir Compartir. Puedes descargar el PDF y enviarlo desde tu celular.");
    } finally { setSharing(false); }
  }

  return <Modal title="Tu informe está listo" sub="VISTA PREVIA · PARA TU CONSULTA" wide report onClose={onClose}>
    <div className="report-export-actions report-action">
      <button className="primary-button" disabled={!pdf || sharing} onClick={() => { if (canShare) share(); else if (pdf) { download(pdf.file); setStatus("PDF descargado. Puedes adjuntarlo desde tus archivos."); } }}>{sharing ? <LoaderCircle size={17} className="spinner" /> : canShare ? <Share2 size={17} /> : <Download size={17} />}{canShare ? "Compartir PDF" : "Descargar PDF"}</button>
      {canShare && <button className="secondary-button" disabled={!pdf || sharing} onClick={() => download(pdf.file)}><Download size={16} />Descargar</button>}
      <button className="secondary-button" onClick={() => window.print()}><Printer size={16} />Imprimir</button>
    </div>
    <p className="report-ready-note report-action" role="status">{!pdf && !error ? <><LoaderCircle size={14} className="spinner" />Preparando el PDF…</> : pdf ? `${pdf.pages} páginas · PDF con resumen y detalle de las tomas` : error}</p>
    {error && <button className="text-button report-action" onClick={() => setRetry((value) => value + 1)}>Volver a preparar el PDF</button>}
    {status && <p className="report-share-status report-action" role="status">{status}</p>}
    <div className="report-content fresh-report">
      <div className="fresh-report-cover"><span className="eyebrow">PASTILLAS · UN REGISTRO PARA TU CONSULTA</span><h2>Tu historial de tomas</h2><b>{model.name || "Registro personal"}</b><p>{model.rangeLabel}</p><span className="fresh-report-scope">{scopeLabel(model.scope)}</span></div>
      <div className="fresh-report-stats"><div><b>{model.records.length}</b><span>Tomas registradas</span></div><div><b>{model.days}</b><span>Días con tomas</span></div><div><b>{model.groups.length}</b><span>Pastillas seleccionadas</span></div></div>
      <h3 className="report-section-title">Tus pastillas, de un vistazo</h3>
      <div className="report-table-wrap"><table className="report-table report-statistics"><caption className="sr-only">Resumen de las pastillas seleccionadas</caption><thead><tr><th scope="col">Pastilla</th><th scope="col">Tomas</th><th scope="col">Días con toma</th><th scope="col">Última toma</th></tr></thead><tbody>{model.groups.map((group) => <tr key={group.key}><th scope="row"><span className="report-med-name"><MedicineMark name={group.name} small /><span>{group.name}</span></span></th><td>{group.count}</td><td>{group.days.size}</td><td>{dateLabel(group.last, true)}</td></tr>)}</tbody></table></div>
      <p className="report-data-note">Las cifras cuentan registros de tomas, no dosis ni cantidad de comprimidos.{model.unknownTimes > 0 && ` ${model.unknownTimes} registros conservan su fecha original, pero no tienen hora registrada.`}{model.records.some((record) => !isNamedMedicine(record.medicine)) && " Las tomas sin nombre se agrupan juntas y pueden corresponder a pastillas diferentes."}</p>
      <h3 className="report-section-title report-detail-heading">El detalle de tus tomas</h3>
      <p className="report-note">El tiempo entre tomas se calcula dentro de este informe para la misma pastilla cuando ambas horas son conocidas. Horas del dispositivo: {model.timeZone}.</p>
      <div className="report-table-wrap"><table className="report-table report-detail-table"><caption className="sr-only">Fechas, horas y tiempo entre las tomas seleccionadas</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Pastilla</th><th scope="col">Hora</th><th scope="col">Registro</th><th scope="col">Tiempo entre tomas</th></tr></thead><tbody>{model.records.map((record) => <tr key={record.id}><td>{dateLabel(record.date, true)}</td><td><span className="report-med-name"><MedicineMark name={record.medicine} small /><span>{medicineLabel(record.medicine)}</span></span></td><td>{recordTime(record)}{record.plannedTime && <small>Prevista {record.plannedTime}</small>}</td><td>{recordType(record)}</td><td>{model.intervals.get(record.id) || "-"}</td></tr>)}</tbody></table></div>
      <p className="report-note">Las horas ausentes y los nombres sin especificar se conservan. «-» indica que no se puede calcular un intervalo exacto.</p>
    </div>
    <button className="text-button report-action report-back" onClick={onClose}><ArrowLeft size={15} />Volver a las estadísticas y ajustar selección</button>
  </Modal>;
}
