import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { activityBuckets, recordTime, recordType, scopeLabel } from "./reportData.js";
import { atTime, durationLabel, isNamedMedicine, medicineLabel } from "./calendar.js";
import { MEDICINE_COLORS, medicineMark } from "./medicineVisual.js";

const INK = "#234d40", MUTED = "#667e73", GREEN = "#347f60", LINE = "#e0ece4", PALE = "#eef7f1";
const numericDate = (date) => date.slice(8, 10) + "/" + date.slice(5, 7) + "/" + date.slice(0, 4);
const clean = (value) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ");

export function createReportPdf(model, fonts) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("Atkinson-Regular.ttf", fonts.regular); doc.addFont("Atkinson-Regular.ttf", "Atkinson", "normal");
  doc.addFileToVFS("Atkinson-Bold.ttf", fonts.bold); doc.addFont("Atkinson-Bold.ttf", "Atkinson", "bold");
  doc.setFont("Atkinson", "normal");
  doc.setProperties({ title: "Historial de tomas - " + clean(model.name || "Pastillas"), subject: model.rangeLabel, creator: "Pastillas", author: clean(model.name || "Registro personal") });
  const margin = 16, width = 178;
  function text(value, x, y, size = 10, color = INK, bold = false, options = {}) {
    doc.setFont("Atkinson", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(color); doc.text(value, x, y, options);
  }
  function pill(name, x, y, size = 8) {
    const mark = medicineMark(name), color = MEDICINE_COLORS[mark.tone];
    doc.setFillColor(color);
    if (mark.shape === "cap") {
      doc.roundedRect(x, y + size * .23, size, size * .54, size * .27, size * .27, "F");
      doc.setFillColor("#ffffff"); doc.circle(x + size * .73, y + size * .5, size * .19, "F");
      doc.setDrawColor("#ffffff"); doc.setLineWidth(.35); doc.line(x + size * .49, y + size * .25, x + size * .49, y + size * .75);
    } else {
      doc.circle(x + size / 2, y + size / 2, size * .37, "F");
      doc.setDrawColor("#ffffff"); doc.setLineWidth(.35); doc.line(x + size * .24, y + size / 2, x + size * .76, y + size / 2);
    }
  }
  function sectionTitle(title, subtitle, y) {
    text(title, margin, y, 14, INK, true);
    text(subtitle, margin, y + 6, 9, MUTED);
    return y + 11;
  }
  function continuationHeader() {
    text("pastillas.", margin, 13, 11, GREEN, true);
    text("Historial de " + clean(model.name || "medicamentos"), margin + 31, 13, 9, MUTED);
    text(numericDate(model.start) + " - " + numericDate(model.end), 194, 13, 8, MUTED, false, { align: "right" });
    doc.setDrawColor(LINE); doc.setLineWidth(.3); doc.line(margin, 18, 194, 18);
  }
  const tableOptions = {
    theme: "plain", margin: { left: margin, right: margin, top: 24, bottom: 20 },
    styles: { font: "Atkinson", fontSize: 9, textColor: INK, cellPadding: 3.5, overflow: "linebreak", valign: "middle", lineColor: LINE, lineWidth: { bottom: .2 } },
    headStyles: { fillColor: PALE, textColor: GREEN, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: "#f8fbf9" }, rowPageBreak: "avoid",
    didDrawPage: () => { if (doc.internal.getCurrentPageInfo().pageNumber > 1) continuationHeader(); },
  };

  doc.setFillColor(PALE); doc.roundedRect(margin, 16, width, 57, 6, 6, "F");
  pill("cápsula", 22, 23, 10); text("pastillas.", 35, 30, 17, GREEN, true);
  text("UN REGISTRO PARA TU CONSULTA", 22, 42, 8.5, MUTED);
  text("Historial de " + clean(model.name || "medicamentos"), 22, 53, 18, INK, true, { maxWidth: 166 });
  text(numericDate(model.start) + " - " + numericDate(model.end) + "  ·  " + scopeLabel(model.scope), 22, 66, 10, MUTED);

  const stats = [[String(model.records.length), "tomas registradas"], [String(model.days), "días con tomas"], [String(model.groups.length), "pastillas en el informe"]];
  stats.forEach(([value, label], i) => {
    const x = margin + i * 61;
    doc.setFillColor(i === 1 ? "#f2f4fa" : i === 2 ? "#faf4eb" : "#f0f7f1"); doc.roundedRect(x, 81, 56, 25, 4, 4, "F");
    text(value, x + 6, 92, 21, INK, true); text(label, x + 6, 100, 8.5, MUTED);
  });
  let y = sectionTitle("Tu actividad", "Cada barra reúne las tomas registradas durante el periodo.", 119);
  const buckets = activityBuckets(model.records, model.start, model.end), max = Math.max(1, ...buckets.map((item) => item.count));
  doc.setFillColor("#f8fbf9"); doc.roundedRect(margin, y, width, 32, 3, 3, "F");
  const barWidth = (width - 12) / buckets.length;
  buckets.forEach((bucket, i) => {
    const height = bucket.count ? Math.max(1.5, bucket.count / max * 20) : .6;
    doc.setFillColor(bucket.count ? GREEN : LINE); doc.roundedRect(margin + 6 + i * barWidth, y + 25 - height, Math.max(1, barWidth - 1.4), height, .5, .5, "F");
  });
  text(numericDate(model.start), margin + 6, y + 30, 7, MUTED);
  text(numericDate(model.end), 188, y + 30, 7, MUTED, false, { align: "right" });
  y = sectionTitle("Tus pastillas, de un vistazo", "Tomas y días registrados para cada pastilla seleccionada.", y + 44);
  autoTable(doc, {
    ...tableOptions, startY: y,
    head: [["Pastilla", "Tomas", "Días con toma", "Última toma"]],
    body: model.groups.map((group) => [clean(group.name), String(group.count), String(group.days.size), numericDate(group.last)]),
    columnStyles: { 0: { cellWidth: 98, cellPadding: { left: 16, right: 4, top: 3.5, bottom: 3.5 } }, 1: { cellWidth: 20, halign: "center" }, 2: { cellWidth: 29, halign: "center" }, 3: { cellWidth: 31 } },
    didDrawCell: (data) => { if (data.section === "body" && data.column.index === 0) pill(model.groups[data.row.index].name, data.cell.x + 4, data.cell.y + (data.cell.height - 8) / 2); },
  });
  y = doc.lastAutoTable.finalY + 9;
  const note = "Las cifras cuentan registros de tomas, no dosis ni cantidad de comprimidos."
    + (model.unknownTimes ? " " + model.unknownTimes + " registros conservan su fecha, pero no tienen una hora registrada." : "")
    + (model.records.some((record) => !isNamedMedicine(record.medicine)) ? " Las tomas sin nombre se agrupan juntas y pueden corresponder a pastillas diferentes." : "");
  doc.setFont("Atkinson", "normal"); doc.setFontSize(9);
  const noteLines = doc.splitTextToSize(note, width - 12), noteHeight = noteLines.length * 4.3 + 10;
  if (y + noteHeight > 276) { doc.addPage(); continuationHeader(); y = 27; }
  doc.setFillColor(PALE); doc.roundedRect(margin, y, width, noteHeight, 3, 3, "F"); text(noteLines, margin + 6, y + 7, 9, MUTED);

  doc.addPage(); continuationHeader();
  y = sectionTitle("El detalle de tus tomas", "Fechas, horas y tiempo desde la toma anterior de la misma pastilla.", 31);
  const timingNote = "El intervalo se calcula solo entre registros del informe con pastilla y hora conocidas. '-' indica que no se puede calcular. Horas del dispositivo: " + model.timeZone + ".";
  doc.setFontSize(8); const timingLines = doc.splitTextToSize(timingNote, width); text(timingLines, margin, y + 1, 8, MUTED); y += timingLines.length * 4 + 5;
  autoTable(doc, {
    ...tableOptions, startY: y,
    head: [["Fecha", "Pastilla", "Hora de toma", "Registro", "Tiempo entre tomas"]],
    body: model.records.map((record) => {
      const planned = record.plannedTime ? atTime(record.date, record.plannedTime) : null;
      const delta = planned && record.takenAt ? record.takenAt - planned : null;
      return [numericDate(record.date), clean(medicineLabel(record.medicine)), recordTime(record) + (record.plannedTime ? "\nPrevista: " + record.plannedTime : ""), recordType(record), (model.intervals.get(record.id) || "-") + (delta !== null ? "\n" + (delta === 0 ? "A la hora prevista" : durationLabel(delta) + (delta < 0 ? " antes de lo previsto" : " después de lo previsto")) : "")];
    }),
    columnStyles: { 0: { cellWidth: 24, fontSize: 8 }, 1: { cellWidth: 55, cellPadding: { left: 12, right: 3, top: 3.5, bottom: 3.5 } }, 2: { cellWidth: 28 }, 3: { cellWidth: 25 }, 4: { cellWidth: 46, fontSize: 8 } },
    didDrawCell: (data) => { if (data.section === "body" && data.column.index === 1) pill(model.records[data.row.index].medicine, data.cell.x + 2, data.cell.y + (data.cell.height - 7) / 2, 7); },
  });
  const pages = doc.getNumberOfPages(), generated = new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(LINE); doc.line(margin, 282, 194, 282);
    text("Pastillas · Registro personal · " + generated, margin, 288, 7.5, MUTED);
    text(page + " / " + pages, 194, 288, 8, MUTED, false, { align: "right" });
  }
  const safeName = clean(model.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
  return { blob: doc.output("blob"), filename: "pastillas" + (safeName ? "-" + safeName : "") + "-" + model.start + "-a-" + model.end + ".pdf", pages };
}
