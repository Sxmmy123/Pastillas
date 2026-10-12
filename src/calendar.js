export const dayKey = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
export const today = () => dayKey(new Date());
export const norm = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
export const UNSPECIFIED = "Pastilla sin especificar";
export const isNamedMedicine = (name) => !!norm(name) && ![norm(UNSPECIFIED), "sin especificar"].includes(norm(name));
export const medicineLabel = (name) => isNamedMedicine(name) ? String(name).trim() : UNSPECIFIED;
export const timeLabel = (stamp, seconds = false) => stamp ? new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), hourCycle: "h23" }).format(new Date(stamp)) : "";
export const atTime = (day, time) => time ? new Date(day + "T" + time + (time.length === 5 ? ":00" : "")).getTime() : null;
export const timeForDay = (day) => day === today() ? Date.now() : atTime(day, timeLabel(Date.now(), true));
export const dateLabel = (day, short = false) => new Intl.DateTimeFormat("es-BO", { ...(short ? {} : { weekday: "long" }), day: "numeric", month: short ? "short" : "long", year: "numeric" }).format(new Date(day + "T12:00:00"));
export const monthTitle = (day) => new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric" }).format(new Date(day + "T12:00:00"));
export function addDays(day, amount) { const date = new Date(day + "T12:00:00"); date.setDate(date.getDate() + amount); return dayKey(date); }
export function addMonths(day, amount) {
  const date = new Date(day + "T12:00:00"), n = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + amount);
  date.setDate(Math.min(n, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())); return dayKey(date);
}
export function daysBetween(first, second) {
  const a = new Date(first + "T12:00:00"), b = new Date(second + "T12:00:00");
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}
export function isDue(plan, date) {
  if (!plan.active || date < plan.startDate || !plan.time) return false;
  const elapsed = daysBetween(plan.startDate, date), step = Number(plan.interval) * (plan.intervalUnit === "weeks" ? 7 : 1);
  if (elapsed < 0 || !step || elapsed % step) return false;
  if (!Number(plan.duration)) return true;
  if (plan.durationUnit === "months") return date < addMonths(plan.startDate, Number(plan.duration));
  return elapsed < Number(plan.duration) * (plan.durationUnit === "weeks" ? 7 : 1);
}
export function rangeFor(day, view) {
  if (view === "year") return [day.slice(0, 4) + "-01-01", day.slice(0, 4) + "-12-31"];
  if (view === "month") return [day.slice(0, 7) + "-01", dayKey(new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0))];
  const start = addDays(day, -(new Date(day + "T12:00:00").getDay() + 6) % 7);
  return [start, addDays(start, 6)];
}
export function entriesFor(date, section, records, plans) {
  const saved = records.filter((item) => item.date === date && (section === "treatments" ? !!item.planId : !item.planId));
  if (section !== "treatments") return saved.sort((a, b) => (a.takenAt || 0) - (b.takenAt || 0));
  const covered = new Set(saved.map((item) => item.planId));
  const due = plans.filter((plan) => isDue(plan, date) && !covered.has(plan.id)).map((plan) => ({
    id: "due-" + plan.id + "-" + date, planId: plan.id, medicine: plan.medicine, date, plannedTime: plan.time, status: "planned", takenAt: null, legacy: false, isVirtual: true,
  }));
  return [...saved, ...due].sort((a, b) => (a.plannedTime || "99:99").localeCompare(b.plannedTime || "99:99"));
}
export function frequentMedicines(records) {
  const map = new Map();
  records.filter((item) => item.status === "taken" && isNamedMedicine(item.medicine)).forEach((item) => {
    const key = norm(item.medicine), old = map.get(key) || { name: item.medicine, count: 0, latest: 0 };
    old.count++; if ((item.takenAt || 0) >= old.latest) { old.name = item.medicine; old.latest = item.takenAt || 0; } map.set(key, old);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || b.latest - a.latest).slice(0, 6);
}
export function durationLabel(milliseconds) {
  let seconds = Math.floor(Math.abs(milliseconds) / 1000);
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  return [days && days + " d", hours && hours + " h", minutes && minutes + " min", seconds && seconds + " s"].filter(Boolean).join(" ") || "0 s";
}
