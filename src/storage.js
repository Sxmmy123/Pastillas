export const OWNER = "pastillas:owner";
const RECORDS = "pastillas:records:v1";
const DELETED = "pastillas:deleted:v1";
const LEGACY_DELETED = "pastillas:legacy-deleted:v1";
const LEGACY_NAMES = "pastillas:legacy-names:v1";
export const recordsKey = (uid) => RECORDS + ":" + uid;
export const plansKey = (uid) => "pastillas:plans:v1:" + uid;
export const prefsKey = (uid) => "pastillas:settings:v1:" + uid;
export const nameKey = (uid) => "pastillas:name:" + uid;
export const profileUid = (id) => "profile-" + id;
export function cleanProfileName(value) {
  const name = String(value || "").trim().normalize("NFC");
  if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error("Escribe un nombre de entre 1 y 40 caracteres.");
  return name;
}
export async function profileKey(value) {
  const name = cleanProfileName(value);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(name));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
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
  if (!uid.startsWith("profile-")) keys.push(LEGACY_DELETED);
  if (previous?.startsWith("local-") && previous !== uid) keys.push(DELETED + ":" + previous);
  if (!previous) keys.push(DELETED);
  return new Set(keys.flatMap((key) => { const value = readJson(key, []); return Array.isArray(value) ? value : []; }));
}
export function writeDeleted(ids, uid) {
  if (!writeJson(DELETED + ":" + uid, [...ids])) return false;
  if (uid.startsWith("profile-")) return true;
  const stored = readJson(LEGACY_DELETED, []), legacy = new Set(Array.isArray(stored) ? stored : []);
  for (const id of ids) if (typeof id === "string" && id.startsWith("legacy-")) legacy.add(id);
  return !legacy.size || writeJson(LEGACY_DELETED, [...legacy]);
}

// The original Bootstrap page used one YYYY-MM-DD = "tomada" key per day.
// These keys belong to this browser's old calendar and must survive UID changes.
// Read them independently from the account namespace; never edit or remove them.
export function readLegacyRecords() {
  const items = [];
  const labels = readJson(LEGACY_NAMES, {});
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const date = localStorage.key(i);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || localStorage.getItem(date) !== "tomada") continue;
      const parsed = new Date(date + "T12:00:00");
      if (Number.isNaN(parsed.getTime()) || parsed.getDate() !== Number(date.slice(-2))) continue;
      const id = "legacy-" + date, label = labels?.[id];
      items.push({ id, medicine: typeof label?.medicine === "string" ? label.medicine : "Pastilla sin especificar", date, status: "taken", takenAt: null, plannedTime: null, legacy: true, updatedAt: Number(label?.updatedAt) || 0 });
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
  return mergeRecords(uid.startsWith("profile-") ? [] : readLegacyRecords(), cached, readDeleted(uid, previous));
}

// A refreshed anonymous sign-in must not make an older local copy unreachable.
// Offer these copies explicitly instead of silently uploading another profile.
export function readSavedHistories(uid, currentRecords = [], currentPlans = [], includeEmpty = false) {
  const histories = [], known = new Map(currentRecords.map((item) => [item.id, item]));
  const knownPlans = new Map(currentPlans.map((item) => [item.id, item]));
  const removed = readDeleted(uid);
  try {
    const prefix = RECORDS + ":", owners = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) owners.add(key.slice(prefix.length));
    }
    for (const owner of owners) {
      if (!owner || owner === uid) continue;
      const cached = readJson(recordsKey(owner), []);
      const records = mergeRecords([], Array.isArray(cached) ? cached : [], readDeleted(owner));
      const plans = readPlans(owner);
      const extra = records.filter((item) => !removed.has(item.id) && (!known.has(item.id) || Number(item.updatedAt || 0) > Number(known.get(item.id).updatedAt || 0)));
      const extraPlans = plans.filter((item) => !knownPlans.has(item.id) || Number(item.updatedAt || 0) > Number(knownPlans.get(item.id).updatedAt || 0));
      const explicitName = localStorage.getItem(nameKey(owner)) || "";
      if (includeEmpty || extra.length || extraPlans.length) histories.push({ uid: owner, name: explicitName || "Historial anterior", explicitName, records, plans, count: extra.length, latest: records.map((item) => item.date).sort().at(-1) });
    }
  } catch {}
  return histories.sort((a, b) => (b.latest || "").localeCompare(a.latest || ""));
}
export function persistRecords(items, uid) {
  // Keep a durable copy of the imported dates as well as their original keys.
  if (!writeJson(recordsKey(uid), items)) return false;
  const stored = readJson(LEGACY_NAMES, {}), labels = stored && typeof stored === "object" && !Array.isArray(stored) ? { ...stored } : {};
  let changed = false;
  items.filter((item) => item.legacy && Number(item.updatedAt) > 0).forEach((item) => {
    if (Number(item.updatedAt) > Number(labels[item.id]?.updatedAt || 0)) { labels[item.id] = { medicine: item.medicine || "", updatedAt: item.updatedAt }; changed = true; }
  });
  return !changed || writeJson(LEGACY_NAMES, labels);
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
  const profileId = /^profile-[a-f0-9]{64}$/.test(uid) ? uid.slice(8) : null;
  return { uid, profileId, records, deleted, plans: readPlans(uid), reminders: readReminders(uid), name };
}
