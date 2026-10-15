import { addDays, atTime, dayKey, timeLabel } from "./calendar.js";

const HOUR = 3600000;
export const isStockPlan = (plan) => plan?.scheduleVersion === 2 && Array.isArray(plan.batches);
export const unitsPerTake = (plan) => Math.max(1, Number(plan.pillsPerDose) || 1);
export const isOvernight = (time) => /^0[0-5]:/.test(time || "");
const validTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time || "");
export function fixedTimes(plan) {
  return [...new Set((plan.mode === "day-night" ? [plan.morningTime, plan.nightTime] : [plan.time]).filter(validTime))].sort();
}

// Quantities are stored by purchase. Unused loose pills carry into the next
// purchase, while every scheduled dose keeps its original, stable identity.
export function stockBatches(plan) {
  if (!isStockPlan(plan)) return [];
  let total = 0, previousSlots = 0;
  return plan.batches.map((batch) => {
    total += Math.max(0, Number(batch.quantity) || 0);
    const allSlots = Math.floor(total / unitsPerTake(plan)), slots = allSlots - previousSlots;
    previousSlots = allSlots;
    return { ...batch, slots };
  });
}

export function slotAt(plan, batch, index) {
  if (plan.mode === "hours") return Number(batch.startAt) + index * Number(plan.intervalHours) * HOUR;
  const times = fixedTimes(plan), first = times.filter((time) => time >= batch.startTime);
  if (!times.length) return NaN;
  if (index < first.length) return atTime(batch.startDate, first[index]);
  const rest = index - first.length;
  return atTime(addDays(batch.startDate, 1 + Math.floor(rest / times.length)), times[rest % times.length]);
}

function lowerBound(plan, batch, stamp) {
  let low = 0, high = batch.slots;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (slotAt(plan, batch, middle) < stamp) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function stockDose(plan, batch, index) {
  const plannedAt = slotAt(plan, batch, index), date = dayKey(new Date(plannedAt));
  const doseKey = plan.id + ":" + batch.id + ":" + index;
  return { id: "due-" + doseKey, doseKey, planId: plan.id, medicine: plan.medicine, date,
    plannedAt, plannedTime: timeLabel(plannedAt), pillQuantity: unitsPerTake(plan),
    status: "planned", takenAt: null, legacy: false, isVirtual: true };
}

export function scheduledDoses(plan, date) {
  if (!isStockPlan(plan) || !plan.active) return [];
  const first = atTime(date, "00:00"), end = atTime(addDays(date, 1), "00:00"), result = [];
  const batches = stockBatches(plan);
  if (plan.pendingPurchase?.startAt) {
    const projected = stockBatches({ ...plan, batches: [...plan.batches, plan.pendingPurchase] }).at(-1);
    batches.push({ ...projected, purchasePending: true });
  }
  for (const batch of batches) {
    const start = lowerBound(plan, batch, first), stop = lowerBound(plan, batch, end);
    for (let index = start; index < stop; index++) result.push({ ...stockDose(plan, batch, index), ...(batch.purchasePending ? { purchasePending: true } : {}) });
  }
  return result;
}

export function stockState(plan, records = []) {
  const batches = stockBatches(plan), units = unitsPerTake(plan);
  const purchased = batches.reduce((sum, batch) => sum + Math.max(0, Number(batch.quantity) || 0), 0);
  const taken = records.filter((record) => record.planId === plan.id && record.status === "taken");
  const consumed = taken.reduce((sum, record) => sum + (Number(record.pillQuantity) || units), 0);
  const remaining = Math.max(0, purchased - consumed), lastBatch = [...batches].reverse().find((batch) => batch.slots > 0);
  return { purchased, consumed, remaining, taken: taken.length, dosesLeft: Math.floor(remaining / units),
    lastDose: lastBatch ? stockDose(plan, lastBatch, lastBatch.slots - 1) : null,
    cycle: batches.at(-1)?.id || "initial", loose: purchased % units };
}

export function treatmentSummary(plan) {
  if (!isStockPlan(plan)) return `Cada ${plan.interval} ${plan.intervalUnit === "weeks" ? "semana(s)" : "día(s)"} · ${plan.time}`;
  if (plan.mode === "hours") return `Cada ${plan.intervalHours} horas · desde ${plan.time}`;
  if (plan.mode === "day-night") return `${plan.morningTime} mañana · ${plan.nightTime} noche`;
  return `${plan.mode === "night" ? "Cada noche" : "Cada mañana"} · ${plan.time}`;
}

export function treatmentPreview(plan, limit = 8) {
  const batches = stockBatches(plan), first = [];
  let overnightCount = 0, totalDoses = 0, firstOvernight = null;
  for (const batch of batches) {
    totalDoses += batch.slots;
    for (let index = 0; index < batch.slots; index++) {
      const stamp = slotAt(plan, batch, index);
      if (first.length < limit) first.push(stockDose(plan, batch, index));
      if (new Date(stamp).getHours() < 6) { overnightCount++; firstOvernight ||= stockDose(plan, batch, index); }
    }
  }
  return { first, last: stockState(plan).lastDose, totalDoses, overnightCount, firstOvernight };
}

export function firstRefillAt(plan, now = Date.now()) {
  const last = stockState(plan).lastDose;
  if (plan.mode === "hours") {
    const step = Number(plan.intervalHours) * HOUR, anchor = last?.plannedAt || atTime(plan.startDate, plan.time);
    return anchor + Math.max(1, Math.ceil((now - anchor) / step)) * step;
  }
  const threshold = Math.max(now, (last?.plannedAt || 0) + 1), date = dayKey(new Date(threshold)), times = fixedTimes(plan);
  return times.map((time) => atTime(date, time)).find((stamp) => stamp >= threshold) || atTime(addDays(date, 1), times[0]);
}

export function makeRefillBatch(plan, quantity, id, now = Date.now()) {
  const startAt = firstRefillAt(plan, now);
  return { id, quantity, startAt, startDate: dayKey(new Date(startAt)), startTime: timeLabel(startAt), addedAt: now };
}

export function shouldOfferRefill(plan, records) {
  if (!isStockPlan(plan) || !plan.active || plan.pendingPurchase) return false;
  const stock = stockState(plan, records);
  return stock.taken > 0 && (stock.remaining <= 2 || stock.dosesLeft === 0) && plan.finishAfterBatch !== stock.cycle;
}

export function validateStockPlan(plan) {
  if (!String(plan.medicine || "").trim()) throw new Error("Escribe el nombre de la pastilla.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate || "") || !validTime(plan.time) || !Number.isFinite(atTime(plan.startDate, plan.time))) throw new Error("Elige una fecha y hora inicial válidas.");
  const units = Number(plan.pillsPerDose), quantity = Number(plan.batches?.[0]?.quantity);
  if (!Number.isInteger(units) || units < 1 || units > 20) throw new Error("Indica entre 1 y 20 pastillas por toma.");
  if (!Number.isInteger(quantity) || quantity < units || quantity > 9999) throw new Error("La cantidad debe cubrir al menos una toma y no superar 9999 pastillas.");
  if (!["hours", "morning", "night", "day-night"].includes(plan.mode)) throw new Error("Elige cómo se repite el tratamiento.");
  if (plan.mode === "hours" && (!Number.isInteger(Number(plan.intervalHours)) || plan.intervalHours < 1 || plan.intervalHours > 168)) throw new Error("Indica un intervalo de entre 1 y 168 horas.");
  if (plan.mode === "day-night" && (!validTime(plan.morningTime) || !validTime(plan.nightTime) || plan.morningTime >= plan.nightTime)) throw new Error("La hora de la mañana debe ser anterior a la hora de la noche.");
  return plan;
}
