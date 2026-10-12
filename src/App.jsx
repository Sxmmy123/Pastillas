import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlarmClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const firebaseApi = () =>
  Promise.all([
    import("./firebase"),
    import("firebase/auth"),
    import("firebase/firestore"),
  ]).then(([app, authApi, store]) => ({ ...app, ...authApi, ...store }));
const KEY = "pastillas:records:v1",
  DEL = "pastillas:deleted:v1",
  OWNER = "pastillas:owner",
  COLORS = ["mint", "coral", "blue", "lavender", "sun", "teal"];
const today = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
const id = () =>
  crypto.randomUUID?.() ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);
const hm = (ms) =>
  ms
    ? new Intl.DateTimeFormat("es-BO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(ms))
    : "";
const ms = (day, time) =>
  time ? new Date(day + "T" + time + ":00").getTime() : null;
const dateLabel = (day) =>
  new Intl.DateTimeFormat("es-BO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(day + "T12:00:00"));
const localRecordsKey = (u) => KEY + ":" + u,
  localDeletedKey = (u) => DEL + ":" + u;
function readDeleted(uid, owner) {
  const source =
    owner === uid
      ? uid
      : owner?.startsWith("local-")
        ? owner
        : !owner
          ? "legacy"
          : null;
  try {
    return new Set(
      JSON.parse(
        localStorage.getItem(
          source === "legacy" ? DEL : source ? localDeletedKey(source) : "",
        ) || "[]",
      ),
    );
  } catch {
    return new Set();
  }
}
function writeDeleted(ids, uid) {
  try {
    localStorage.setItem(localDeletedKey(uid), JSON.stringify([...ids]));
  } catch {}
}
function readRecords(uid, owner) {
  let a = [];
  const source =
    owner === uid ? uid : owner?.startsWith("local-") ? owner : null;
  try {
    a = JSON.parse(
      localStorage.getItem(
        source ? localRecordsKey(source) : !owner ? KEY : "",
      ) || "[]",
    );
  } catch {}
  if (!Array.isArray(a)) a = [];
  if (!owner || owner === uid || owner.startsWith("local-")) {
    const ids = new Set(a.map((x) => x.id));
    for (let i = 0; i < localStorage.length; i++) {
      const d = localStorage.key(i);
      if (
        d &&
        /^\d{4}-\d{2}-\d{2}$/.test(d) &&
        localStorage.getItem(d) === "tomada" &&
        !ids.has("legacy-" + d)
      )
        a.push({
          id: "legacy-" + d,
          medicine: "Pastilla sin especificar",
          date: d,
          status: "taken",
          takenAt: null,
          plannedTime: null,
          legacy: true,
          updatedAt: 0,
        });
    }
  }
  return a;
}
function persist(a, uid) {
  try {
    localStorage.setItem(
      localRecordsKey(uid),
      JSON.stringify(a.filter((x) => !x.legacy)),
    );
  } catch {}
}
function merge(local, remote, deleted) {
  const m = new Map(local.map((x) => [x.id, x]));
  remote.forEach((x) => {
    const p = m.get(x.id);
    if (!p || (Number(x.updatedAt) || 0) > (Number(p.updatedAt) || 0))
      m.set(x.id, { ...x, legacy: !!x.legacy });
  });
  return [...m.values()].filter((x) => !deleted.has(x.id));
}
function mark(name) {
  const n = norm(name);
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0;
  return {
    tone: COLORS[Math.abs(h) % COLORS.length],
    shape: /capsula|capsule|gelcap/.test(n)
      ? "cap"
      : /pastilla|tableta|comprimido|tablet/.test(n)
        ? "tab"
        : Math.abs(h >> 3) % 2
          ? "cap"
          : "tab",
  };
}
function Med({ name }) {
  const m = mark(name);
  return (
    <span className={"medicine-mark " + m.tone} aria-hidden="true">
      {m.shape === "cap" ? (
        <svg viewBox="0 0 48 48">
          <g transform="rotate(-38 24 24)">
            <rect
              x="8"
              y="15"
              width="32"
              height="18"
              rx="9"
              fill="currentColor"
            />
            <path
              d="M24 15v18"
              stroke="white"
              strokeOpacity=".8"
              strokeWidth="2"
            />
            <path
              d="M24 16h7a8 8 0 0 1 0 16h-7z"
              fill="white"
              fillOpacity=".55"
            />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="15" fill="currentColor" />
          <path
            d="M14 24h20"
            stroke="white"
            strokeOpacity=".8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="18" cy="18" r="2" fill="white" fillOpacity=".5" />
        </svg>
      )}
    </span>
  );
}
function Modal({ title, sub, onClose, children, wide = false }) {
  useEffect(() => {
    const f = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={"modal-card" + (wide ? " modal-wide" : "")}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{sub}</p>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Card({ r, onTake, onDelete }) {
  const delta =
    r.plannedTime && r.takenAt
      ? Math.round((r.takenAt - ms(r.date, r.plannedTime)) / 60000)
      : null;
  const text =
    delta === null
      ? null
      : Math.abs(delta) <= 1
        ? "A tiempo"
        : Math.abs(delta) + " min " + (delta < 0 ? "antes" : "tarde");
  return (
    <article
      className={"dose-card" + (r.status === "taken" ? " dose-taken" : "")}
    >
      <Med name={r.medicine} />
      <div className="dose-content">
        <div className="dose-title-row">
          <h3>{r.medicine}</h3>
          {r.legacy && <span className="legacy-pill">Histórico</span>}
        </div>
        <div className="dose-times">
          <span>
            <AlarmClock size={14} />
            {r.plannedTime ? "Prevista " + r.plannedTime : "Hora no registrada"}
          </span>
          {r.status === "taken" && (
            <span className="actual-time">
              <CheckCircle2 size={14} />
              {r.takenAt ? "Tomada " + hm(r.takenAt) : "Tomada"}
            </span>
          )}
        </div>
        {text && (
          <p className={"time-delta" + (text === "A tiempo" ? " on-time" : "")}>
            {text}
          </p>
        )}
      </div>
      {!r.legacy && (
        <div className="dose-actions">
          {r.status !== "taken" && (
            <button
              className="take-button"
              onClick={() => onTake(r)}
              aria-label={"Marcar " + r.medicine + " como tomada"}
            >
              <Check size={16} />
              <span>Tomada</span>
            </button>
          )}
          <button
            className="icon-button delete-button"
            onClick={() => onDelete(r)}
            aria-label={"Eliminar " + r.medicine}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </article>
  );
}
function Calendar({ value, records, onClose, onSelect }) {
  const [v, setV] = useState(new Date(value + "T12:00:00"));
  const y = v.getFullYear(),
    m = v.getMonth(),
    offset = (new Date(y, m, 1).getDay() + 6) % 7,
    count = new Date(y, m + 1, 0).getDate(),
    title = new Intl.DateTimeFormat("es-BO", {
      month: "long",
      year: "numeric",
    }).format(v);
  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];
  return (
    <Modal
      title="Tu calendario"
      sub="HISTORIAL DE TOMAS"
      onClose={onClose}
      wide
    >
      <div className="calendar-topline">
        <button
          className="icon-button"
          onClick={() => setV(new Date(y, m - 1, 1))}
          aria-label="Mes anterior"
        >
          <ChevronLeft />
        </button>
        <strong>{title}</strong>
        <button
          className="icon-button"
          onClick={() => setV(new Date(y, m + 1, 1))}
          aria-label="Mes siguiente"
        >
          <ChevronRight />
        </button>
      </div>
      <div className="calendar-grid">
        {["L", "M", "X", "J", "V", "S", "D"].map((x, i) => (
          <span className="calendar-weekday" key={i}>
            {x}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={"b" + i} />;
          const k =
              y +
              "-" +
              String(m + 1).padStart(2, "0") +
              "-" +
              String(d).padStart(2, "0"),
            has = records.some((r) => r.date === k);
          return (
            <button
              key={k}
              className={
                "calendar-day" +
                (value === k ? " selected" : "") +
                (k === today() ? " is-today" : "")
              }
              onClick={() => onSelect(k)}
            >
              {d}
              {has && <i />}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i />
          Día con registros
        </span>
        <span>Selecciona un día para ver tus tomas</span>
      </div>
    </Modal>
  );
}
function AddModal({ date, suggestions, onClose, onSave }) {
  const [medicine, S] = useState(""),
    [mode, M] = useState("planned"),
    [day, D] = useState(date),
    [planned, P] = useState("09:00"),
    [actual, A] = useState(hm(Date.now())),
    [error, E] = useState("");
  function submit(e) {
    e.preventDefault();
    if (!medicine.trim()) {
      E("Escribe el nombre del medicamento.");
      return;
    }
    onSave({
      medicine: medicine.trim(),
      date: day,
      plannedTime: planned || null,
      status: mode === "taken" ? "taken" : "planned",
      takenAt: mode === "taken" ? ms(day, actual) : null,
    });
  }
  return (
    <Modal title="Añadir una toma" sub="NUEVO REGISTRO" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label className="field-label">
          Nombre del medicamento
          <input
            autoFocus
            list="medicine-list"
            value={medicine}
            onChange={(e) => S(e.target.value)}
            placeholder="Ej. Paracetamol 500 mg"
            maxLength={70}
          />
        </label>
        <datalist id="medicine-list">
          {suggestions.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        {medicine.trim() && (
          <div className="medicine-preview">
            <Med name={medicine} />
            <span>
              Icono para <b>{medicine}</b>, igual en cada registro.
            </span>
          </div>
        )}
        <label className="field-label">
          Día
          <input
            type="date"
            value={day}
            onChange={(e) => D(e.target.value)}
            required
          />
        </label>
        <div className="segmented">
          <button
            type="button"
            className={mode === "taken" ? "active" : ""}
            onClick={() => M("taken")}
          >
            <CheckCircle2 size={16} />
            Ya la tomé
          </button>
          <button
            type="button"
            className={mode === "planned" ? "active" : ""}
            onClick={() => M("planned")}
          >
            <AlarmClock size={16} />
            Programar
          </button>
        </div>
        {mode === "planned" ? (
          <label className="field-label">
            Hora prevista
            <input
              type="time"
              value={planned}
              onChange={(e) => P(e.target.value)}
              required
            />
          </label>
        ) : (
          <>
            <label className="field-label">
              Hora prevista{" "}
              <span className="optional">(opcional, para comparar)</span>
              <input
                type="time"
                value={planned}
                onChange={(e) => P(e.target.value)}
              />
            </label>
            <label className="field-label">
              Hora en que la tomaste
              <input
                type="time"
                value={actual}
                onChange={(e) => A(e.target.value)}
                required
              />
            </label>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-button">
          <Plus size={18} />
          {mode === "taken" ? "Guardar toma" : "Programar toma"}
        </button>
      </form>
    </Modal>
  );
}
export default function App() {
  const [records, R] = useState([]),
    [uid, U] = useState(""),
    [cloud, C] = useState(false),
    [authError, AE] = useState(false),
    [sync, SYNC] = useState("connecting"),
    [loaded, L] = useState(false),
    [dirty, DIRTY] = useState(new Set()),
    [deletes, DELSET] = useState(new Set()),
    [retry, RETRY] = useState(0),
    [name, N] = useState(""),
    [day, DAY] = useState(today),
    [modal, MODAL] = useState(""),
    [selected, SEL] = useState(null),
    [calendar, CAL] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const f = await firebaseApi();
        await f.setPersistence(f.auth, f.browserLocalPersistence);
        const user =
          f.auth.currentUser || (await f.signInAnonymously(f.auth)).user;
        if (!live) return;
        const previous = localStorage.getItem(OWNER),
          localData = readRecords(user.uid, previous),
          oldName = previous?.startsWith("local-")
            ? localStorage.getItem("pastillas:name:" + previous)
            : "";
        if (oldName && !localStorage.getItem("pastillas:name:" + user.uid))
          localStorage.setItem("pastillas:name:" + user.uid, oldName);
        const deletedData = readDeleted(user.uid, previous);
        R(localData);
        persist(localData, user.uid);
        DELSET(deletedData);
        localStorage.setItem(OWNER, user.uid);
        U(user.uid);
        C(true);
        SYNC("syncing");
        N(localStorage.getItem("pastillas:name:" + user.uid) || "");
      } catch {
        if (!live) return;
        let owner = localStorage.getItem(OWNER),
          key = owner || localStorage.getItem("pastillas:offline-user");
        if (!key) {
          key = "local-" + id();
          localStorage.setItem("pastillas:offline-user", key);
        }
        const localData = readRecords(key, owner),
          deletedData = readDeleted(key, owner);
        R(localData);
        persist(localData, key);
        DELSET(deletedData);
        localStorage.setItem(OWNER, key);
        U(key);
        N(localStorage.getItem("pastillas:name:" + key) || "");
        AE(true);
        SYNC("local");
        L(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!uid || !cloud) return;
    let live = true;
    (async () => {
      try {
        const f = await firebaseApi(),
          ref = f.collection(f.db, "usuarios", uid, "registros"),
          [profile, snap] = await Promise.all([
            f.getDoc(f.doc(f.db, "usuarios", uid)),
            f.getDocs(ref),
          ]);
        if (!live) return;
        const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          known = new Set(remote.map((x) => x.id)),
          all = merge(records, remote, deletes);
        R(all);
        persist(all, uid);
        DIRTY((old) => {
          const n = new Set(old);
          all.forEach((x) => {
            if (!known.has(x.id)) n.add(x.id);
          });
          return n;
        });
        const saved = profile.exists() ? profile.data().displayName : "",
          cached = localStorage.getItem("pastillas:name:" + uid) || "";
        N(saved || cached);
        if (saved || cached)
          localStorage.setItem("pastillas:name:" + uid, saved || cached);
        L(true);
        SYNC("online");
      } catch {
        if (live) {
          L(true);
          SYNC("local");
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [uid, cloud, retry]);
  useEffect(() => {
    const f = () => RETRY((x) => x + 1);
    window.addEventListener("online", f);
    return () => window.removeEventListener("online", f);
  }, []);
  useEffect(() => {
    if (!uid || !cloud || !loaded || (!dirty.size && !deletes.size)) return;
    let live = true;
    const t = setTimeout(async () => {
      const ups = new Set(dirty),
        dels = new Set(deletes);
      SYNC("syncing");
      try {
        for (let i = 0; i < ups.size; i += 400) {
          const f = await firebaseApi(),
            batch = f.writeBatch(f.db);
          [...ups].slice(i, i + 400).forEach((key) => {
            const item = records.find((x) => x.id === key);
            if (item)
              batch.set(f.doc(f.db, "usuarios", uid, "registros", key), item);
          });
          await batch.commit();
        }
        for (const key of dels)
          await f.deleteDoc(f.doc(f.db, "usuarios", uid, "registros", key));
        if (!live) return;
        DIRTY((old) => new Set([...old].filter((x) => !ups.has(x))));
        DELSET((old) => {
          const next = new Set([...old].filter((x) => !dels.has(x)));
          writeDeleted(next, uid);
          return next;
        });
        SYNC("online");
      } catch {
        if (live) SYNC("local");
      }
    }, 600);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [uid, cloud, loaded, dirty, deletes, records, retry]);
  const list = useMemo(
      () =>
        records
          .filter((x) => x.date === day)
          .sort((a, b) =>
            (a.plannedTime || "99:99").localeCompare(b.plannedTime || "99:99"),
          ),
      [records, day],
    ),
    names = useMemo(
      () =>
        [
          ...new Set(records.filter((x) => !x.legacy).map((x) => x.medicine)),
        ].sort((a, b) => a.localeCompare(b, "es")),
      [records],
    ),
    taken = list.filter((x) => x.status === "taken").length,
    pending = list.length - taken,
    todayView = day === today(),
    monthCount = records.filter(
      (x) => x.status === "taken" && x.date.slice(0, 7) === day.slice(0, 7),
    ).length;
  function saveNew(data) {
    const item = { id: id(), ...data, legacy: false, updatedAt: Date.now() };
    const next = [...records, item];
    R(next);
    persist(next, uid);
    DIRTY((old) => new Set(old).add(item.id));
    MODAL("");
  }
  function take(r, time) {
    const item = {
        ...r,
        status: "taken",
        takenAt: ms(r.date, time),
        updatedAt: Date.now(),
      },
      next = records.map((x) => (x.id === r.id ? item : x));
    R(next);
    persist(next, uid);
    DIRTY((old) => new Set(old).add(r.id));
    SEL(null);
    MODAL("");
  }
  function remove(r) {
    const next = records.filter((x) => x.id !== r.id);
    R(next);
    persist(next, uid);
    if (!r.legacy) {
      DELSET((old) => {
        const n = new Set(old).add(r.id);
        writeDeleted(n, uid);
        return n;
      });
      DIRTY((old) => {
        const n = new Set(old);
        n.delete(r.id);
        return n;
      });
    }
    SEL(null);
    MODAL("");
  }
  function profile(e) {
    e.preventDefault();
    const value = new FormData(e.currentTarget)
      .get("displayName")
      ?.toString()
      .trim();
    if (!value) return;
    N(value);
    localStorage.setItem("pastillas:name:" + uid, value);
    if (cloud)
      firebaseApi()
        .then((f) =>
          f.setDoc(
            f.doc(f.db, "usuarios", uid),
            { displayName: value, updatedAt: Date.now() },
            { merge: true },
          ),
        )
        .then(() => SYNC("online"))
        .catch(() => SYNC("local"));
    MODAL("");
  }
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("") || "T";
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <a className="brand" href="./">
          <span className="brand-icon">
            <Activity size={21} />
          </span>
          <span>
            pastillas<span className="brand-dot">.</span>
            <small>MI REGISTRO PERSONAL</small>
          </span>
        </a>
        <div className="side-label">ESPACIO PERSONAL</div>
        <button className="side-link active" onClick={() => DAY(today())}>
          <CalendarDays size={18} />
          Mi día
          <span className="side-live" />
        </button>
        <button className="side-link" onClick={() => CAL(true)}>
          <History size={18} />
          Historial
        </button>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={18} />
            <div>
              <b>Tu espacio privado</b>
              <span>Solo tú ves tus registros.</span>
            </div>
          </div>
          <button className="profile-button" onClick={() => MODAL("profile")}>
            <span className="avatar">{initials}</span>
            <span className="profile-copy">
              <b>{name || "Tu perfil"}</b>
              <small>Perfil personal</small>
            </span>
            <ChevronRight size={17} />
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-icon">
              <Activity size={19} />
            </span>
            <b>
              pastillas<span className="brand-dot">.</span>
            </b>
          </div>
          <div className="sync-indicator">
            <span
              className={
                "sync-dot " +
                (sync === "online"
                  ? "is-online"
                  : sync === "syncing" || sync === "connecting"
                    ? "is-syncing"
                    : "")
              }
            >
              {sync === "syncing" || sync === "connecting" ? (
                <LoaderCircle size={12} />
              ) : null}
            </span>
            {sync === "online"
              ? "Guardado en la nube"
              : sync === "local"
                ? "Guardado en este dispositivo"
                : "Sincronizando"}
          </div>
          <button
            className="avatar top-avatar"
            onClick={() => MODAL("profile")}
            aria-label="Perfil"
          >
            {initials}
          </button>
        </header>
        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow greeting">
                {todayView ? "TU RUTINA, A TU RITMO" : "TU HISTORIAL PERSONAL"}
              </p>
              <h1>
                {todayView ? (
                  <>
                    Hola, {name ? name.split(/\s+/)[0] : "bienvenido"}{" "}
                    <span className="wave">✦</span>
                  </>
                ) : (
                  "Tu registro"
                )}
              </h1>
              <p className="date-line">
                {todayView ? "Hoy, " : ""}
                {dateLabel(day)}
              </p>
            </div>
            <button className="date-picker-button" onClick={() => CAL(true)}>
              <CalendarDays size={17} />
              <span>{todayView ? "Ver calendario" : "Cambiar día"}</span>
            </button>
          </section>
          <section className="summary-panel">
            <div className="summary-copy">
              <span className="summary-icon">
                <Sparkles size={17} />
              </span>
              <div>
                <p className="summary-label">
                  {todayView ? "TU PROGRESO DE HOY" : "RESUMEN DEL DÍA"}
                </p>
                <h2>
                  {taken} <span>de</span> {list.length}{" "}
                  <span>
                    {list.length === 1
                      ? "toma registrada"
                      : "tomas registradas"}
                  </span>
                </h2>
                <p>
                  {pending
                    ? pending +
                      (pending === 1
                        ? " pendiente por registrar"
                        : " pendientes por registrar")
                    : list.length
                      ? "Todo al día por ahora"
                      : "Agrega tus medicamentos cuando quieras"}
                </p>
              </div>
            </div>
            <div
              className="progress-ring"
              style={{
                "--progress": list.length
                  ? Math.round((taken / list.length) * 100)
                  : 0,
              }}
            >
              <div>
                <b>
                  {list.length ? Math.round((taken / list.length) * 100) : 0}
                  <small>%</small>
                </b>
              </div>
            </div>
            <div className="summary-bottom">
              <span>
                <CheckCircle2 size={15} />
                {taken} tomadas
              </span>
              <span>
                <Clock3 size={15} />
                {pending} pendientes
              </span>
              <span>
                <Activity size={15} />
                {monthCount} este mes
              </span>
            </div>
          </section>
          <section className="doses-section">
            <div className="section-heading">
              <div>
                <h2>{todayView ? "Tus tomas" : "Tomas del día"}</h2>
                <p>
                  {list.length
                    ? "Un vistazo claro a cada medicamento."
                    : "Tu día empieza con un registro sencillo."}
                </p>
              </div>
              <span className="count-badge">{list.length}</span>
            </div>
            {list.length ? (
              <div className="dose-list">
                {list.map((r) => (
                  <Card
                    key={r.id}
                    r={r}
                    onTake={(x) => {
                      SEL(x);
                      MODAL("take");
                    }}
                    onDelete={(x) => {
                      SEL(x);
                      MODAL("delete");
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-art">
                  <span className="empty-orbit orbit-one" />
                  <span className="empty-orbit orbit-two" />
                  <Med name="tableta" />
                </div>
                <h3>Un día más claro empieza aquí</h3>
                <p>
                  Registra lo que ya tomaste o programa tu próxima toma en
                  segundos.
                </p>
                <button className="primary-button" onClick={() => MODAL("add")}>
                  <Plus size={18} />
                  Añadir primera toma
                </button>
              </div>
            )}
            {list.length > 0 && (
              <button className="add-row-button" onClick={() => MODAL("add")}>
                <span>
                  <Plus size={17} />
                </span>
                Añadir otra toma
              </button>
            )}
          </section>
          <footer className="footnote">
            <ShieldCheck size={15} />
            Un registro para acompañarte. Tu información es personal y privada.
          </footer>
        </div>
      </main>
      <nav className="mobile-nav">
        <button className="mobile-nav-link active" onClick={() => DAY(today())}>
          <CalendarDays size={19} />
          <span>Mi día</span>
        </button>
        <button
          className="mobile-add"
          onClick={() => MODAL("add")}
          aria-label="Añadir toma"
        >
          <Plus size={22} />
        </button>
        <button className="mobile-nav-link" onClick={() => CAL(true)}>
          <History size={19} />
          <span>Historial</span>
        </button>
      </nav>
      {modal === "add" && (
        <AddModal
          date={day}
          suggestions={names}
          onClose={() => MODAL("")}
          onSave={saveNew}
        />
      )}
      {modal === "take" && selected && (
        <Modal
          title="Registrar toma"
          sub={selected.medicine.toUpperCase()}
          onClose={() => {
            MODAL("");
            SEL(null);
          }}
        >
          <div className="confirm-med">
            <Med name={selected.medicine} />
            <div>
              <b>{selected.medicine}</b>
              <span>
                {selected.plannedTime
                  ? "Estaba prevista a las " + selected.plannedTime
                  : "Sin hora prevista"}
              </span>
            </div>
          </div>
          <p className="modal-copy">
            ¿A qué hora la tomaste? Así podrás comparar la hora real con la
            programada.
          </p>
          <label className="field-label">
            Hora real
            <input
              autoFocus
              id="actual-time"
              type="time"
              defaultValue={
                selected.date === today()
                  ? hm(Date.now())
                  : selected.plannedTime || "12:00"
              }
            />
          </label>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => {
                MODAL("");
                SEL(null);
              }}
            >
              Volver
            </button>
            <button
              className="primary-button"
              onClick={() =>
                take(selected, document.getElementById("actual-time").value)
              }
            >
              <Check size={17} />
              Guardar hora
            </button>
          </div>
        </Modal>
      )}
      {modal === "delete" && selected && (
        <Modal
          title="¿Eliminar este registro?"
          sub="CONFIRMAR CAMBIO"
          onClose={() => {
            MODAL("");
            SEL(null);
          }}
        >
          <div className="confirm-med">
            <Med name={selected.medicine} />
            <div>
              <b>{selected.medicine}</b>
              <span>
                {dateLabel(selected.date)}
                {selected.plannedTime ? " · " + selected.plannedTime : ""}
              </span>
            </div>
          </div>
          <p className="modal-copy">
            Se quitará de tu historial en este dispositivo y de tu espacio
            sincronizado.
          </p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => {
                MODAL("");
                SEL(null);
              }}
            >
              Conservar
            </button>
            <button className="danger-button" onClick={() => remove(selected)}>
              <Trash2 size={16} />
              Eliminar
            </button>
          </div>
        </Modal>
      )}
      {modal === "profile" && (
        <Modal
          title="Tu perfil"
          sub="ESPACIO PERSONAL"
          onClose={() => MODAL("")}
        >
          <div className="profile-identity">
            <span className="avatar avatar-large">{initials}</span>
            <div>
              <b>{name || "Tu perfil"}</b>
              <span>
                {cloud
                  ? "ID de usuario · " + uid.slice(0, 7)
                  : "Guardado local en este navegador"}
              </span>
            </div>
          </div>
          <form className="form-stack" onSubmit={profile}>
            <label className="field-label">
              ¿Cómo te llamamos?
              <input
                name="displayName"
                defaultValue={name}
                placeholder="Tu nombre"
                maxLength={40}
                required
              />
            </label>
            <p className="privacy-note">
              <ShieldCheck size={15} />
              El nombre solo identifica tu perfil. Tus datos se separan por
              identidad anónima.
            </p>
            {authError && (
              <p className="form-error">
                Firebase no está disponible. Puedes seguir registrando aquí.
              </p>
            )}
            <button className="primary-button full-button">
              {name ? "Guardar nombre" : "Continuar"}
              <ChevronRight size={17} />
            </button>
          </form>
        </Modal>
      )}
      {!name && loaded && modal !== "profile" && (
        <Modal
          title="Tu registro, a tu manera"
          sub="BIENVENIDO A PASTILLAS"
          onClose={() => MODAL("profile")}
        >
          <p className="modal-copy intro-copy">
            Elige un nombre para identificar este espacio. Tus tomas quedan
            vinculadas a un perfil anónimo, aunque otra persona use el mismo
            nombre.
          </p>
          <form className="form-stack" onSubmit={profile}>
            <label className="field-label">
              Tu nombre
              <input
                autoFocus
                name="displayName"
                placeholder="Por ejemplo, Sxmy"
                maxLength={40}
                required
              />
            </label>
            <p className="privacy-note">
              <ShieldCheck size={15} />
              {cloud
                ? "Tu identidad se recordará en este navegador."
                : "Tu registro seguirá disponible aquí."}
            </p>
            <button className="primary-button full-button">
              Empezar mi registro
              <ChevronRight size={17} />
            </button>
          </form>
        </Modal>
      )}
      {calendar && (
        <Calendar
          value={day}
          records={records}
          onClose={() => CAL(false)}
          onSelect={(x) => {
            DAY(x);
            CAL(false);
          }}
        />
      )}
    </div>
  );
}
