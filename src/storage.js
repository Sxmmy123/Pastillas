export const OWNER = "pastillas:owner";
const RECORDS = "pastillas:records:v1";
const DELETED = "pastillas:deleted:v1";
export const recordsKey = (uid) => RECORDS + ":" + uid;
export const plansKey = (uid) => "pastillas:plans:v1:" + uid;
export const prefsKey = (uid) => "pastillas:settings:v1:" + uid;
export const nameKey = (uid) => "pastillas:name:" + uid;
export const makeId = () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);

export function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}
export function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function readPlans(uid) { const items = readJson(plansKey(uid), []); return Array.isArray(items) ? items : []; }
export function readReminders(uid) { const prefs = readJson(prefsKey(uid), {}); return prefs?.remindersEnabled !== false; }
export function readDeleted(uid, previous = uid) {
  const keys = [DELETED + ":" + uid];
  if (previous?.startsWith("local-") && previous !== uid) keys.push(DELETED + ":" + previous);
  if (!previous) keys.push(DELETED);
  return new Set(keys.flatMap((key) => { const value = readJson(key, []); return Array.isArray(value) ? value : []; }));
}
export function writeDeleted(ids, uid) { return writeJson(DELETED + ":" + uid, [...ids]); }

// The original Bootstrap page used one YYYY-MM-DD = "tomada" key per day.
// These keys belong to this browser's old calendar and must survive UID changes.
// Read them independently from the account namespace; never edit or remove them.
export function readLegacyRecords() {
  const items = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const date = localStorage.key(i);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || localStorage.getItem(date) !== "tomada") continue;
      const parsed = new Date(date + "T12:00:00");
      if (Number.isNaN(parsed.getTime()) || parsed.getDate() !== Number(date.slice(-2))) continue;
      items.push({ id: "legacy-" + date, medicine: "Pastilla sin especificar", date, status: "taken", takenAt: null, plannedTime: null, legacy: true, updatedAt: 0 });
    }
  } catch {}
  return items;
}
export function mergeRecords(local, remote, deleted = new Set()) {
  const map = new Map();
  [...local, ...remote].forEach((item) => {
    if (!item?.id || !item.date || deleted.has(item.id)) return;
    const previous = map.get(item.id);
    if (!previous || (Number(item.updatedAt) || 0) >= (Number(previous.updatedAt) || 0)) map.set(item.id, item);
  });
  return [...map.values()];
}
export function readRecords(uid, previous = uid) {
  const keys = [recordsKey(uid)];
  if (previous?.startsWith("local-") && previous !== uid) keys.push(recordsKey(previous));
  if (!previous) keys.push(RECORDS);
  const cached = keys.flatMap((key) => { const items = readJson(key, []); return Array.isArray(items) ? items : []; });
  return mergeRecords(readLegacyRecords(), cached, readDeleted(uid, previous));
}
export function persistRecords(items, uid) {
  // Keep a durable copy of the imported dates as well as their original keys.
  return writeJson(recordsKey(uid), items);
}
export function mergePlans(local, remote) {
  const map = new Map(local.map((item) => [item.id, item]));
  remote.forEach((item) => { const old = map.get(item.id); if (!old || (Number(item.updatedAt) || 0) >= (Number(old.updatedAt) || 0)) map.set(item.id, item); });
  return [...map.values()];
}
export function loadLocalSession() {
  let uid;
  try { uid = localStorage.getItem(OWNER) || localStorage.getItem("pastillas:offline-user"); } catch {}
  const previous = uid || null;
  if (!uid) {
    uid = "local-" + makeId();
    try { localStorage.setItem("pastillas:offline-user", uid); } catch {}
  }
  const records = readRecords(uid, previous), deleted = readDeleted(uid, previous);
  persistRecords(records, uid);
  try { localStorage.setItem(OWNER, uid); } catch {}
  let name = "";
  try { name = localStorage.getItem(nameKey(uid)) || ""; } catch {}
  return { uid, records, deleted, plans: readPlans(uid), reminders: readReminders(uid), name };
}
