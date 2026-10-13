import { addDays, dateLabel, daysBetween, durationLabel, isNamedMedicine, medicineLabel, norm, timeLabel } from "./calendar.js";

export const scopeLabel = (scope) => scope === "treatments" ? "Tratamientos" : scope === "records" ? "Uso ocasional" : "Todas las tomas";
export const recordType = (record) => record.planId ? "Tratamiento" : record.legacy ? "Histórico" : "Ocasional";
export const hasExactTime = (record) => Number.isFinite(record.takenAt) && record.takenAt > 0;
export const medicineKey = (record) => norm(medicineLabel(record.medicine));
export const recordTime = (record) => hasExactTime(record) ? timeLabel(record.takenAt, true) : "No registrada";

export function reportRecords(records, start, end, scope) {
  return records.filter((record) => record.status === "taken" && record.date >= start && record.date <= end
    && (scope === "all" || (scope === "treatments" ? !!record.planId : !record.planId)))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.takenAt || 0) - (b.takenAt || 0) || a.id.localeCompare(b.id));
}

export function medicineStats(records) {
  const groups = new Map();
  for (const record of records) {
    const key = medicineKey(record), group = groups.get(key) || { key, name: medicineLabel(record.medicine), count: 0, days: new Set(), first: record.date, last: record.date, unknownTimes: 0 };
    group.count++; group.days.add(record.date);
    if (record.date < group.first) group.first = record.date;
    if (record.date > group.last) { group.last = record.date; group.name = medicineLabel(record.medicine); }
    if (!hasExactTime(record)) group.unknownTimes++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

export function activityBuckets(records, start, end) {
  const length = daysBetween(start, end) + 1, step = Math.max(1, Math.ceil(length / 24));
  const buckets = Array.from({ length: Math.ceil(length / step) }, (_, i) => ({ start: addDays(start, i * step), end: addDays(start, Math.min(length - 1, (i + 1) * step - 1)), count: 0 }));
  for (const record of records) {
    const index = Math.floor(daysBetween(start, record.date) / step);
    if (buckets[index]) buckets[index].count++;
  }
  return buckets;
}

// An unknown time breaks the chain: never infer a precise interval across it.
export function reportIntervals(records) {
  const previous = new Map(), intervals = new Map();
  for (const record of records) {
    const key = medicineKey(record), before = previous.get(key);
    intervals.set(record.id, isNamedMedicine(record.medicine) && hasExactTime(record) && hasExactTime(before || {}) && record.takenAt >= before.takenAt
      ? durationLabel(record.takenAt - before.takenAt) : "-");
    previous.set(key, record);
  }
  return intervals;
}

export function reportModel({ records, start, end, scope, name }) {
  return { records, start, end, scope, name, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, groups: medicineStats(records), intervals: reportIntervals(records),
    days: new Set(records.map((record) => record.date)).size, unknownTimes: records.filter((record) => !hasExactTime(record)).length,
    rangeLabel: dateLabel(start, true) + " - " + dateLabel(end, true) };
}
