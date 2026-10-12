import { useEffect, useMemo, useRef, useState } from "react";
import { OWNER, loadLocalSession, readRecords, readDeleted, readPlans, readReminders, readSavedHistories, nameKey, plansKey, prefsKey, writeJson, persistRecords, writeDeleted, mergeRecords, mergePlans, makeId } from "./storage";
import { timeForDay } from "./calendar";

export const firebaseApi = () => Promise.all([import("./firebase"), import("firebase/auth"), import("firebase/firestore")]).then(([app, auth, store]) => ({ ...app, ...auth, ...store }));

export default function useJournal() {
  // Local history is ready before Firebase starts, even when offline.
  const [boot] = useState(loadLocalSession);
  const [uid, setUid] = useState(boot.uid), [records, setRecords] = useState(boot.records), [plans, setPlans] = useState(boot.plans);
  const [name, setName] = useState(boot.name), [reminders, setReminders] = useState(boot.reminders);
  const [cloud, setCloud] = useState(false), [cloudReady, setCloudReady] = useState(false), [sync, setSync] = useState("connecting"), [cloudError, setCloudError] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [loadedCloudRecords, setLoadedCloudRecords] = useState(null);
  const [dirty, setDirty] = useState(new Set()), [deleted, setDeleted] = useState(boot.deleted), [pendingDeletes, setPendingDeletes] = useState(boot.deleted), [retry, setRetry] = useState(0);
  const state = useRef({}); state.current = { uid, records, plans, name, reminders, deleted };
  const nameTouched = useRef(false), remindersTouched = useRef(false);
  const savedHistories = useMemo(() => readSavedHistories(uid, records, plans), [uid, records, plans]);

  useEffect(() => {
    if (cloud) return;
    let live = true;
    (async () => {
      try {
        const f = await firebaseApi();
        await f.setPersistence(f.auth, f.browserLocalPersistence); await f.auth.authStateReady();
        const user = f.auth.currentUser || (await f.signInAnonymously(f.auth)).user;
        if (!live) return;
        const previous = state.current.uid, all = readRecords(user.uid, previous), tombstones = readDeleted(user.uid, previous);
        const combinedPlans = mergePlans(readPlans(user.uid), previous.startsWith("local-") ? state.current.plans : []);
        const profileName = localStorage.getItem(nameKey(user.uid)) || (previous.startsWith("local-") ? state.current.name : "");
        const reminderValue = previous.startsWith("local-") ? state.current.reminders : readReminders(user.uid);
        persistRecords(all, user.uid); writeJson(plansKey(user.uid), combinedPlans); writeJson(prefsKey(user.uid), { remindersEnabled: reminderValue }); writeDeleted(tombstones, user.uid);
        localStorage.setItem(OWNER, user.uid); if (profileName) localStorage.setItem(nameKey(user.uid), profileName);
        setRecords(all); setPlans(combinedPlans); setName(profileName); setReminders(reminderValue); setDeleted(tombstones); setPendingDeletes(tombstones);
        setUid(user.uid); setCloudReady(false); setProfileReady(false); setLoadedCloudRecords(null); setCloud(true); setSync("syncing");
      } catch (error) { if (live) { setCloudError(error.code || "No se pudo conectar con Firebase."); setSync("local"); } }
    })();
    return () => { live = false; };
  }, [retry, cloud]);

  useEffect(() => {
    if (!cloud) return; let live = true;
    (async () => {
      try {
        const f = await firebaseApi();
        const [profile, snapshot] = await Promise.all([f.getDoc(f.doc(f.db, "usuarios", uid)), f.getDocs(f.collection(f.db, "usuarios", uid, "registros"))]);
        if (!live) return;
        const remote = snapshot.docs.map((item) => ({ ...item.data(), id: item.id })), data = profile.exists() ? profile.data() : {};
        const current = state.current, all = mergeRecords(current.records, remote, current.deleted), known = new Map(remote.map((item) => [item.id, item]));
        state.current.records = all; setRecords(all); persistRecords(all, uid); setLoadedCloudRecords(remote.length);
        setDirty((old) => { const next = new Set(old); all.forEach((item) => { const other = known.get(item.id); if (!other || Number(item.updatedAt) > Number(other.updatedAt || 0)) next.add(item.id); }); return next; });
        const combined = mergePlans(current.plans, Array.isArray(data.plans) ? data.plans : []); setPlans(combined); writeJson(plansKey(uid), combined);
        if (!nameTouched.current && data.displayName) { setName(data.displayName); localStorage.setItem(nameKey(uid), data.displayName); }
        if (!remindersTouched.current && typeof data.remindersEnabled === "boolean") { setReminders(data.remindersEnabled); writeJson(prefsKey(uid), { remindersEnabled: data.remindersEnabled }); }
        setCloudReady(true); setProfileReady(true); setCloudError(""); setSync("online");
      } catch (error) { if (live) { setCloudReady(false); setProfileReady(false); setCloudError(error.code || "La nube no está disponible."); setSync("local"); } }
    })();
    return () => { live = false; };
  }, [uid, cloud, retry]);

  useEffect(() => { const reconnect = () => setRetry((n) => n + 1); window.addEventListener("online", reconnect); return () => window.removeEventListener("online", reconnect); }, []);
  useEffect(() => {
    if (!cloud || !cloudReady || (!dirty.size && !pendingDeletes.size)) return; let live = true;
    const timer = setTimeout(async () => {
      const sent = records.filter((item) => dirty.has(item.id)), removed = new Set(pendingDeletes); setSync("syncing");
      try {
        const f = await firebaseApi();
        for (let i = 0; i < sent.length; i += 400) {
          const batch = f.writeBatch(f.db);
          sent.slice(i, i + 400).forEach((item) => batch.set(f.doc(f.db, "usuarios", uid, "registros", item.id), item)); await batch.commit();
        }
        for (const key of removed) await f.deleteDoc(f.doc(f.db, "usuarios", uid, "registros", key));
        if (!live) return;
        setDirty((old) => new Set([...old].filter((key) => { const item = sent.find((x) => x.id === key), latest = state.current.records.find((x) => x.id === key); return !item || (latest && latest.updatedAt !== item.updatedAt); })));
        setPendingDeletes((old) => new Set([...old].filter((key) => !removed.has(key)))); setCloudError(""); setSync("online");
      } catch (error) { if (live) { setCloudError(error.code || "No se pudo sincronizar."); setSync("local"); } }
    }, 600);
    return () => { live = false; clearTimeout(timer); };
  }, [uid, cloud, cloudReady, dirty, pendingDeletes, records, retry]);

  useEffect(() => {
    writeJson(plansKey(uid), plans); writeJson(prefsKey(uid), { remindersEnabled: reminders });
    if (!cloud || !profileReady) return; let live = true;
    const timer = setTimeout(async () => {
      try { const f = await firebaseApi(); await f.setDoc(f.doc(f.db, "usuarios", uid), { plans, remindersEnabled: reminders, displayName: name, updatedAt: Date.now() }, { merge: true }); }
      catch (error) { if (live) { setCloudError(error.code || "No se pudo sincronizar el perfil."); setSync("local"); } }
    }, 650);
    return () => { live = false; clearTimeout(timer); };
  }, [uid, cloud, profileReady, plans, reminders, name]);

  function store(next) {
    if (!persistRecords(next, state.current.uid)) throw new Error("El navegador no pudo guardar la toma. Revisa el espacio disponible e inténtalo otra vez.");
    state.current.records = next; setRecords(next);
  }
  function saveRecord(data) {
    const item = { id: makeId(), ...data, legacy: false, updatedAt: Date.now() };
    const next = [...state.current.records, item];
    if (!persistRecords(next, state.current.uid)) throw new Error("El navegador no pudo guardar la toma. Inténtalo otra vez.");
    state.current.records = next; setRecords(next); setDirty((old) => new Set(old).add(item.id)); return item;
  }
  function takeDose(dose) {
    const existing = state.current.records.find((item) => item.planId === dose.planId && item.date === dose.date && item.status === "taken");
    if (existing) return existing;
    const item = { id: dose.isVirtual ? makeId() : dose.id, planId: dose.planId, medicine: dose.medicine, date: dose.date, plannedTime: dose.plannedTime || null, status: "taken", takenAt: timeForDay(dose.date), legacy: false, updatedAt: Date.now() };
    store(dose.isVirtual ? [...state.current.records, item] : state.current.records.map((old) => old.id === item.id ? item : old));
    setDirty((old) => new Set(old).add(item.id)); return item;
  }
  function removeRecord(record) {
    const current = state.current, nextDeleted = new Set(current.deleted).add(record.id);
    if (!writeDeleted(nextDeleted, current.uid)) throw new Error("No se pudo guardar la eliminación en este navegador. Inténtalo otra vez.");
    const nextRecords = current.records.filter((item) => item.id !== record.id);
    // Tombstones already make deletion durable even if the cache cannot shrink.
    // Original legacy date keys remain untouched and are filtered on import.
    persistRecords(nextRecords, current.uid);
    state.current.records = nextRecords; state.current.deleted = nextDeleted;
    setRecords(nextRecords); setDeleted(nextDeleted);
    setPendingDeletes((old) => new Set(old).add(record.id)); setDirty((old) => { const next = new Set(old); next.delete(record.id); return next; });
  }
  function renameRecord(recordId, medicine) {
    const existing = state.current.records.find((item) => item.id === recordId);
    if (!existing) throw new Error("Esta toma ya no está en tu historial.");
    const updated = { ...existing, medicine: medicine.trim(), updatedAt: Math.max(Date.now(), Number(existing.updatedAt || 0) + 1) };
    store(state.current.records.map((item) => item.id === recordId ? updated : item));
    setDirty((old) => new Set(old).add(recordId)); return updated;
  }
  function savePlan(plan) {
    const next = [...state.current.plans, plan];
    if (!writeJson(plansKey(state.current.uid), next)) throw new Error("No se pudo guardar el tratamiento en este navegador.");
    state.current.plans = next; setPlans(next);
  }
  function togglePlan(plan) { const next = state.current.plans.map((item) => item.id === plan.id ? { ...item, active: !item.active, updatedAt: Date.now() } : item); writeJson(plansKey(uid), next); state.current.plans = next; setPlans(next); }
  function saveName(value) { nameTouched.current = true; setName(value); try { localStorage.setItem(nameKey(uid), value); } catch {} }
  function changeReminders(value) { remindersTouched.current = true; setReminders(value); }
  function reconnect() {
    setCloudError(""); setCloudReady(false); setProfileReady(false);
    setSync(cloud ? "syncing" : "connecting"); setRetry((n) => n + 1);
  }
  function restoreLocalHistory(historyUid) {
    const current = state.current;
    const history = readSavedHistories(current.uid, current.records, current.plans).find((item) => item.uid === historyUid);
    if (!history) throw new Error("Esta copia ya está incluida en tu historial.");
    const nextRecords = mergeRecords(history.records, current.records, current.deleted);
    const nextPlans = mergePlans(history.plans, current.plans);
    if (!persistRecords(nextRecords, current.uid) || !writeJson(plansKey(current.uid), nextPlans)) throw new Error("No se pudo guardar la copia recuperada. El historial original sigue conservado.");
    state.current.records = nextRecords; state.current.plans = nextPlans;
    setRecords(nextRecords); setPlans(nextPlans);
    const imported = new Set(history.records.map((item) => item.id));
    setDirty((old) => new Set([...old, ...nextRecords.filter((item) => imported.has(item.id)).map((item) => item.id)]));
    if (!current.name && history.name !== "Historial anterior") saveName(history.name);
    return history;
  }
  return { uid, records, plans, name, reminders, sync, cloudError, loadedCloudRecords, savedHistories, reconnect, restoreLocalHistory, saveRecord, takeDose, removeRecord, renameRecord, savePlan, togglePlan, saveName, changeReminders };
}
