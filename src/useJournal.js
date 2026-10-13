import { useEffect, useMemo, useRef, useState } from "react";
import { OWNER, loadLocalSession, readRecords, readDeleted, readPlans, readReminders, readSavedHistories, nameKey, plansKey, prefsKey, writeJson, persistRecords, writeDeleted, mergeRecords, mergePlans, makeId, cleanProfileName, profileKey, profileUid } from "./storage";
import { timeForDay } from "./calendar";

export const firebaseApi = () => Promise.all([import("./firebase"), import("firebase/auth"), import("firebase/firestore")]).then(([app, auth, store]) => ({ ...app, ...auth, ...store }));
const snapshotRecords = (snapshot) => snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
const differs = (left, right) => JSON.stringify(left) !== JSON.stringify(right);

export default function useJournal() {
  const [boot] = useState(loadLocalSession);
  const [uid, setUid] = useState(boot.uid), [profileId, setProfileId] = useState(boot.profileId);
  const [authUid, setAuthUid] = useState(""), [records, setRecords] = useState(boot.records), [plans, setPlans] = useState(boot.plans);
  const [name, setName] = useState(boot.name), [reminders, setReminders] = useState(boot.reminders);
  const [cloud, setCloud] = useState(false), [cloudReady, setCloudReady] = useState(false), [profileReady, setProfileReady] = useState(false);
  const [sync, setSync] = useState("connecting"), [cloudError, setCloudError] = useState(""), [loadedCloudRecords, setLoadedCloudRecords] = useState(null);
  const [dirty, setDirty] = useState(new Set()), [deleted, setDeleted] = useState(boot.deleted), [pendingDeletes, setPendingDeletes] = useState(boot.deleted);
  const [importedLegacyUids, setImportedLegacyUids] = useState([]), [retry, setRetry] = useState(0);
  const state = useRef({}), epoch = useRef(0), remindersTouched = useRef(false);
  state.current = { uid, profileId, authUid, records, plans, name, reminders, deleted, importedLegacyUids };
  const savedHistories = useMemo(() => readSavedHistories(uid, records, plans), [uid, records, plans]);

  // Anonymous authentication identifies this installation; the entered name
  // selects the shared profile. The two identifiers have different purposes.
  useEffect(() => {
    if (cloud) return;
    let live = true;
    (async () => {
      try {
        const f = await firebaseApi();
        await f.setPersistence(f.auth, f.browserLocalPersistence); await f.auth.authStateReady();
        const user = f.auth.currentUser || (await f.signInAnonymously(f.auth)).user;
        if (!live) return;
        const current = state.current;
        if (!current.profileId) {
          const all = readRecords(user.uid, current.uid), removed = readDeleted(user.uid, current.uid);
          const nextPlans = mergePlans(readPlans(user.uid), current.uid.startsWith("local-") ? current.plans : []);
          const nextName = localStorage.getItem(nameKey(user.uid)) || current.name;
          const nextReminders = current.uid.startsWith("local-") ? current.reminders : readReminders(user.uid);
          persistRecords(all, user.uid); writeDeleted(removed, user.uid); writeJson(plansKey(user.uid), nextPlans);
          localStorage.setItem(OWNER, user.uid);
          state.current = { ...current, uid: user.uid, authUid: user.uid, records: all, plans: nextPlans, name: nextName, reminders: nextReminders, deleted: removed };
          setUid(user.uid); setRecords(all); setPlans(nextPlans); setName(nextName); setReminders(nextReminders); setDeleted(removed); setPendingDeletes(removed);
        } else state.current.authUid = user.uid;
        setAuthUid(user.uid); setCloud(true); setCloudReady(false); setProfileReady(false); setSync("syncing");
      } catch (error) { if (live) { setCloudError(error.code || "No se pudo conectar con Firebase."); setSync("local"); } }
    })();
    return () => { live = false; };
  }, [cloud, retry]);

  useEffect(() => {
    if (!cloud || !authUid) return;
    let live = true;
    const turn = epoch.current;
    const valid = () => live && epoch.current === turn && state.current.uid === uid;
    (async () => {
      try {
        const f = await firebaseApi();
        if (!profileId) {
          const [profile, snapshot] = await Promise.all([f.getDoc(f.doc(f.db, "usuarios", authUid)), f.getDocs(f.collection(f.db, "usuarios", authUid, "registros"))]);
          if (!valid()) return;
          const current = state.current, data = profile.exists() ? profile.data() : {};
          const remote = snapshotRecords(snapshot), all = mergeRecords(current.records, remote, current.deleted);
          const nextPlans = mergePlans(current.plans, Array.isArray(data.plans) ? data.plans : []);
          const nextName = current.name || data.displayName || "";
          const nextReminders = !remindersTouched.current && typeof data.remindersEnabled === "boolean" ? data.remindersEnabled : current.reminders;
          state.current = { ...current, records: all, plans: nextPlans, name: nextName, reminders: nextReminders };
          persistRecords(all, uid); writeJson(plansKey(uid), nextPlans);
          setRecords(all); setPlans(nextPlans); setName(nextName); setReminders(nextReminders); setLoadedCloudRecords(remote.length);
          if (nextName) { await enterName(nextName); return; }
          const known = new Map(remote.map((item) => [item.id, item]));
          setDirty(new Set(all.filter((item) => !known.has(item.id) || Number(item.updatedAt || 0) > Number(known.get(item.id).updatedAt || 0)).map((item) => item.id)));
          setCloudReady(true); setProfileReady(true); setCloudError(""); setSync("online");
          return;
        }

        const enteredName = state.current.name;
        await f.setDoc(f.doc(f.db, "sesiones", authUid), { profileId, displayName: enteredName, updatedAt: Date.now() });
        if (!valid()) return;
        const root = f.doc(f.db, "perfiles", profileId);
        const [profile, snapshot, removed, legacyUsers] = await Promise.all([
          f.getDoc(root), f.getDocs(f.collection(root, "registros")), f.getDocs(f.collection(root, "eliminados")),
          f.getDocs(f.query(f.collection(f.db, "usuarios"), f.where("displayName", "==", enteredName))),
        ]);
        if (!valid()) return;
        const data = profile.exists() ? profile.data() : {}, remote = snapshotRecords(snapshot);
        const alreadyImported = new Set(Array.isArray(data.importedLegacyUids) ? data.importedLegacyUids : []);
        const sources = legacyUsers.docs.filter((item) => !alreadyImported.has(item.id));
        // Import every old anonymous profile carrying this exact name. Original
        // documents stay intact; the completion ledger is saved after upload.
        const oldSnapshots = await Promise.all(sources.map((item) => f.getDocs(f.collection(item.ref, "registros"))));
        if (!valid()) return;
        const current = state.current, remoteDeleted = new Set(removed.docs.map((item) => item.id));
        const localSources = readSavedHistories(uid, current.records, current.plans, true).filter((item) => item.explicitName === enteredName);
        const allDeleted = new Set([...current.deleted, ...remoteDeleted, ...localSources.flatMap((item) => [...readDeleted(item.uid)])]);
        const oldRecords = [...oldSnapshots.flatMap(snapshotRecords), ...localSources.flatMap((item) => item.records)];
        const all = mergeRecords(mergeRecords(oldRecords, current.records, allDeleted), remote, allDeleted);
        const oldPlans = [...sources.flatMap((item) => Array.isArray(item.data().plans) ? item.data().plans : []), ...localSources.flatMap((item) => item.plans)];
        const nextPlans = mergePlans(mergePlans(oldPlans, current.plans), Array.isArray(data.plans) ? data.plans : []);
        const nextReminders = !remindersTouched.current && typeof data.remindersEnabled === "boolean" ? data.remindersEnabled : current.reminders;
        const imported = [...new Set([...alreadyImported, ...sources.map((item) => item.id)])];
        const known = new Map(remote.map((item) => [item.id, item]));
        const unsent = new Set(all.filter((item) => !known.has(item.id) || Number(item.updatedAt || 0) > Number(known.get(item.id).updatedAt || 0)).map((item) => item.id));
        const unsentDeletes = new Set([...allDeleted].filter((id) => !remoteDeleted.has(id)));
        state.current = { ...current, records: all, plans: nextPlans, reminders: nextReminders, deleted: allDeleted, importedLegacyUids: imported };
        persistRecords(all, uid); writeDeleted(allDeleted, uid); writeJson(plansKey(uid), nextPlans);
        setRecords(all); setPlans(nextPlans); setReminders(nextReminders); setDeleted(allDeleted); setImportedLegacyUids(imported);
        setDirty(unsent); setPendingDeletes(unsentDeletes); setLoadedCloudRecords(remote.length);
        setCloudReady(true); setProfileReady(true); setCloudError(""); setSync(unsent.size || unsentDeletes.size ? "syncing" : "online");
      } catch (error) { if (valid()) { setCloudReady(false); setProfileReady(false); setCloudError(error.code || "No se pudo cargar el historial."); setSync("local"); } }
    })();
    return () => { live = false; };
  }, [uid, profileId, authUid, cloud, retry]);

  useEffect(() => {
    const reconnect = () => { setCloudReady(false); setProfileReady(false); setRetry((value) => value + 1); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, []);

  useEffect(() => {
    if (!cloud || !cloudReady || (!dirty.size && !pendingDeletes.size)) return;
    let live = true;
    const turn = epoch.current, valid = () => live && turn === epoch.current && state.current.uid === uid;
    const timer = setTimeout(async () => {
      const sent = records.filter((item) => dirty.has(item.id)), removed = [...pendingDeletes]; setSync("syncing");
      try {
        const f = await firebaseApi(), root = f.doc(f.db, profileId ? "perfiles" : "usuarios", profileId || authUid);
        for (let i = 0; i < sent.length; i += 400) {
          if (!valid()) return;
          const batch = f.writeBatch(f.db);
          sent.slice(i, i + 400).forEach((item) => batch.set(f.doc(root, "registros", item.id), item)); await batch.commit();
        }
        for (let i = 0; i < removed.length; i += 200) {
          if (!valid()) return;
          const batch = f.writeBatch(f.db);
          removed.slice(i, i + 200).forEach((id) => {
            if (profileId) batch.set(f.doc(root, "eliminados", id), { deletedAt: Date.now() });
            batch.delete(f.doc(root, "registros", id));
          });
          await batch.commit();
        }
        if (!valid()) return;
        setDirty((old) => new Set([...old].filter((id) => { const item = sent.find((entry) => entry.id === id), latest = state.current.records.find((entry) => entry.id === id); return !item || (latest && latest.updatedAt !== item.updatedAt); })));
        setPendingDeletes((old) => new Set([...old].filter((id) => !removed.includes(id)))); setCloudError(""); setSync("online");
      } catch (error) { if (valid()) { setCloudError(error.code || "No se pudo sincronizar."); setSync("local"); } }
    }, 600);
    return () => { live = false; clearTimeout(timer); };
  }, [uid, profileId, authUid, cloud, cloudReady, dirty, pendingDeletes, records, retry]);

  useEffect(() => {
    writeJson(plansKey(uid), plans); writeJson(prefsKey(uid), { remindersEnabled: reminders });
    if (!cloud || !profileReady || dirty.size || pendingDeletes.size) return;
    let live = true;
    const turn = epoch.current;
    const timer = setTimeout(async () => {
      try {
        const f = await firebaseApi();
        if (!live || turn !== epoch.current) return;
        const data = { plans, remindersEnabled: reminders, displayName: name, updatedAt: Date.now() };
        if (profileId) data.importedLegacyUids = importedLegacyUids;
        await f.setDoc(f.doc(f.db, profileId ? "perfiles" : "usuarios", profileId || authUid), data, { merge: true });
        if (live && turn === epoch.current) remindersTouched.current = false;
      } catch (error) { if (live && turn === epoch.current) { setCloudError(error.code || "No se pudo sincronizar el perfil."); setSync("local"); } }
    }, 650);
    return () => { live = false; clearTimeout(timer); };
  }, [uid, profileId, authUid, cloud, profileReady, plans, reminders, name, importedLegacyUids, dirty.size, pendingDeletes.size]);

  // Once the name is selected, changes from another device arrive live.
  useEffect(() => {
    if (!cloud || !cloudReady || !profileId) return;
    let live = true; const stop = [], turn = epoch.current;
    const valid = () => live && turn === epoch.current && state.current.uid === uid;
    (async () => {
      const f = await firebaseApi();
      if (!valid()) return;
      const root = f.doc(f.db, "perfiles", profileId);
      const fail = (error) => { if (valid()) { setCloudError(error.code || "No se pudo actualizar el historial."); setSync("local"); } };
      stop.push(f.onSnapshot(f.collection(root, "registros"), (snapshot) => {
        if (!valid() || snapshot.metadata.fromCache) return;
        const current = state.current, remote = snapshotRecords(snapshot), all = mergeRecords(current.records, remote, current.deleted);
        setLoadedCloudRecords(remote.length);
        if (differs(all, current.records)) { state.current.records = all; setRecords(all); persistRecords(all, uid); }
      }, fail));
      stop.push(f.onSnapshot(f.collection(root, "eliminados"), (snapshot) => {
        if (!valid() || snapshot.metadata.fromCache) return;
        const current = state.current, remote = new Set(snapshot.docs.map((item) => item.id)), nextDeleted = new Set([...current.deleted, ...remote]);
        const all = current.records.filter((item) => !nextDeleted.has(item.id));
        if (nextDeleted.size !== current.deleted.size) { state.current.deleted = nextDeleted; setDeleted(nextDeleted); writeDeleted(nextDeleted, uid); }
        if (differs(all, current.records)) { state.current.records = all; setRecords(all); persistRecords(all, uid); }
      }, fail));
      stop.push(f.onSnapshot(root, (snapshot) => {
        if (!valid() || !snapshot.exists() || snapshot.metadata.fromCache) return;
        const current = state.current, data = snapshot.data();
        const nextPlans = mergePlans(current.plans, Array.isArray(data.plans) ? data.plans : []);
        if (differs(nextPlans, current.plans)) { state.current.plans = nextPlans; setPlans(nextPlans); writeJson(plansKey(uid), nextPlans); }
        if (!remindersTouched.current && typeof data.remindersEnabled === "boolean" && data.remindersEnabled !== current.reminders) { state.current.reminders = data.remindersEnabled; setReminders(data.remindersEnabled); }
      }, fail));
    })().catch((error) => { if (valid()) { setCloudError(error.code || "No se pudo escuchar el historial."); setSync("local"); } });
    return () => { live = false; stop.forEach((unsubscribe) => unsubscribe()); };
  }, [uid, profileId, cloud, cloudReady]);

  async function enterName(value) {
    const nextName = cleanProfileName(value), nextProfileId = await profileKey(nextName), nextUid = profileUid(nextProfileId);
    const current = state.current;
    const canImport = !current.profileId && (!current.name || current.name === nextName);
    const localSources = readSavedHistories(nextUid, [], [], true).filter((item) => item.explicitName === nextName);
    const nextDeleted = new Set([...readDeleted(nextUid), ...(canImport ? current.deleted : []), ...localSources.flatMap((item) => [...readDeleted(item.uid)])]);
    const nextRecords = mergeRecords([...localSources.flatMap((item) => item.records), ...(canImport ? current.records : [])], readRecords(nextUid), nextDeleted);
    const nextPlans = mergePlans([...localSources.flatMap((item) => item.plans), ...(canImport ? current.plans : [])], readPlans(nextUid));
    const nextReminders = canImport ? current.reminders : readReminders(nextUid);
    if (!persistRecords(nextRecords, nextUid) || !writeDeleted(nextDeleted, nextUid) || !writeJson(plansKey(nextUid), nextPlans)) throw new Error("No se pudo guardar el perfil en este navegador. Las copias anteriores siguen conservadas.");
    localStorage.setItem(OWNER, nextUid); localStorage.setItem(nameKey(nextUid), nextName);
    epoch.current++; remindersTouched.current = false;
    state.current = { ...current, uid: nextUid, profileId: nextProfileId, name: nextName, records: nextRecords, plans: nextPlans, reminders: nextReminders, deleted: nextDeleted, importedLegacyUids: [] };
    setUid(nextUid); setProfileId(nextProfileId); setName(nextName); setRecords(nextRecords); setPlans(nextPlans); setReminders(nextReminders); setDeleted(nextDeleted);
    setPendingDeletes(nextDeleted); setDirty(new Set()); setImportedLegacyUids([]); setLoadedCloudRecords(null);
    setCloudReady(false); setProfileReady(false); setCloudError(""); setSync(cloud ? "syncing" : "connecting"); setRetry((old) => old + 1);
    return nextName;
  }

  function store(next) {
    if (!persistRecords(next, state.current.uid)) throw new Error("El navegador no pudo guardar la toma. Inténtalo otra vez.");
    state.current.records = next; setRecords(next);
  }
  function saveRecord(data, expectedUid = state.current.uid) {
    if (expectedUid !== state.current.uid) throw new Error("Registro anulado al cambiar de perfil.");
    const item = { id: makeId(), ...data, legacy: false, updatedAt: Date.now() };
    store([...state.current.records, item]); setDirty((old) => new Set(old).add(item.id)); return item;
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
    persistRecords(nextRecords, current.uid); state.current.records = nextRecords; state.current.deleted = nextDeleted;
    setRecords(nextRecords); setDeleted(nextDeleted); setPendingDeletes((old) => new Set(old).add(record.id)); setDirty((old) => { const next = new Set(old); next.delete(record.id); return next; });
  }
  function renameRecord(recordId, medicine) {
    const existing = state.current.records.find((item) => item.id === recordId);
    if (!existing) throw new Error("Esta toma ya no está en tu historial.");
    const updated = { ...existing, medicine: medicine.trim(), updatedAt: Math.max(Date.now(), Number(existing.updatedAt || 0) + 1) };
    store(state.current.records.map((item) => item.id === recordId ? updated : item)); setDirty((old) => new Set(old).add(recordId)); return updated;
  }
  function savePlan(plan) {
    const next = [...state.current.plans, plan];
    if (!writeJson(plansKey(state.current.uid), next)) throw new Error("No se pudo guardar el tratamiento en este navegador.");
    state.current.plans = next; setPlans(next);
  }
  function togglePlan(plan) { const next = state.current.plans.map((item) => item.id === plan.id ? { ...item, active: !item.active, updatedAt: Date.now() } : item); writeJson(plansKey(uid), next); state.current.plans = next; setPlans(next); }
  function changeReminders(value) { remindersTouched.current = true; state.current.reminders = value; setReminders(value); }
  function reconnect() { epoch.current++; setCloudError(""); setCloudReady(false); setProfileReady(false); setSync(cloud ? "syncing" : "connecting"); setRetry((old) => old + 1); }
  function restoreLocalHistory(historyUid) {
    const current = state.current, history = readSavedHistories(current.uid, current.records, current.plans).find((item) => item.uid === historyUid);
    if (!history) throw new Error("Esta copia ya está incluida en tu historial.");
    const nextRecords = mergeRecords(history.records, current.records, current.deleted), nextPlans = mergePlans(history.plans, current.plans);
    if (!persistRecords(nextRecords, current.uid) || !writeJson(plansKey(current.uid), nextPlans)) throw new Error("No se pudo guardar la copia recuperada. El historial original sigue conservado.");
    state.current.records = nextRecords; state.current.plans = nextPlans; setRecords(nextRecords); setPlans(nextPlans);
    const imported = new Set(history.records.map((item) => item.id));
    setDirty((old) => new Set([...old, ...nextRecords.filter((item) => imported.has(item.id)).map((item) => item.id)]));
    return history;
  }
  return { uid, profileId, records, plans, name, reminders, sync, cloudError, loadedCloudRecords, savedHistories, enterName, reconnect, restoreLocalHistory, saveRecord, takeDose, removeRecord, renameRecord, savePlan, togglePlan, changeReminders };
}
