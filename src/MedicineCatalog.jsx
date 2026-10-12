import { useEffect, useRef, useState } from "react";
import { Pill } from "lucide-react";
import { today } from "./calendar.js";

const MOVE_THRESHOLD = 6;
const HOLD_DELAY = 280;
const SCROLL_SPEED = 360;

function releaseCapture(active) {
  try {
    if (active.element.hasPointerCapture?.(active.id)) active.element.releasePointerCapture?.(active.id);
  } catch { /* The browser may already have ended this pointer. */ }
}

function stopWork(active) {
  clearTimeout(active.timer);
  if (active.frame !== null) cancelAnimationFrame(active.frame);
  active.frame = null;
}

export default function MedicineCatalog({ medicines, onPick, onDrop, onHoverDate }) {
  const [ghost, setGhost] = useState(null);
  const pointer = useRef(null);
  const hover = useRef(null);
  const suppressClick = useRef(false);
  const callbacks = useRef({ onPick, onDrop, onHoverDate });
  callbacks.current = { onPick, onDrop, onHoverDate };

  function updateHover(date) {
    if (hover.current === date) return;
    hover.current = date;
    callbacks.current.onHoverDate?.(date);
  }

  function dateAt(x, y) {
    const date = document.elementFromPoint(x, y)?.closest("[data-calendar-date]")?.dataset.calendarDate;
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today() ? date : null;
  }

  function beginDrag(active) {
    if (pointer.current !== active || active.cancelled) return;
    clearTimeout(active.timer);
    active.dragging = true;
    suppressClick.current = true;
    setGhost({ name: active.name, x: active.x, y: active.y });
    updateHover(dateAt(active.x, active.y));
    active.lastFrame = null;
    const scrollFrame = (timestamp) => {
      if (pointer.current !== active || !active.dragging) return;
      const elapsed = active.lastFrame === null ? 0 : Math.min(timestamp - active.lastFrame, 32);
      active.lastFrame = timestamp;
      const height = window.innerHeight;
      const direction = active.y < 80 ? -Math.min((80 - active.y) / 80, 1)
        : active.y > height - 110 ? Math.min((active.y - (height - 110)) / 110, 1) : 0;
      const scroller = document.scrollingElement;
      if (scroller && direction && elapsed) {
        const before = scroller.scrollTop;
        scroller.scrollTop += direction * SCROLL_SPEED * elapsed / 1000;
        if (scroller.scrollTop !== before) updateHover(dateAt(active.x, active.y));
      }
      active.frame = requestAnimationFrame(scrollFrame);
    };
    active.frame = requestAnimationFrame(scrollFrame);
  }

  function finish(active) {
    stopWork(active);
    pointer.current = null;
    setGhost(null);
    updateHover(null);
    releaseCapture(active);
  }

  function pointerDown(event, name) {
    if (pointer.current && (!event.isPrimary || event.pointerId !== pointer.current.id)) {
      suppressClick.current = true;
      finish(pointer.current);
      return;
    }
    if (!event.isPrimary || event.button !== 0 || pointer.current) return;
    suppressClick.current = false;
    const active = {
      id: event.pointerId, name, element: event.currentTarget,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      held: event.pointerType === "touch" || event.pointerType === "pen",
      dragging: false, cancelled: false, timer: null, frame: null, lastFrame: null,
    };
    try {
      if (typeof active.element.setPointerCapture !== "function") return;
      active.element.setPointerCapture(active.id);
      if (!active.element.hasPointerCapture?.(active.id)) return;
    } catch { return; }
    pointer.current = active;
    if (active.held) active.timer = setTimeout(() => beginDrag(active), HOLD_DELAY);
  }

  function pointerMove(event) {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    active.x = event.clientX;
    active.y = event.clientY;
    const moved = Math.hypot(active.x - active.startX, active.y - active.startY) >= MOVE_THRESHOLD;
    if (!active.dragging && !active.cancelled && moved) {
      if (active.held) {
        clearTimeout(active.timer);
        active.cancelled = true;
        suppressClick.current = true;
      } else beginDrag(active);
    }
    if (active.dragging) {
      event.preventDefault();
      setGhost({ name: active.name, x: active.x, y: active.y });
      updateHover(dateAt(active.x, active.y));
    }
  }

  function pointerUp(event) {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    const date = active.dragging ? dateAt(event.clientX, event.clientY) : null;
    finish(active);
    if (date) callbacks.current.onDrop?.(active.name, date);
  }

  function pointerCancel(event) {
    const active = pointer.current;
    if (!active || active.id !== event.pointerId) return;
    suppressClick.current = true;
    finish(active);
  }

  useEffect(() => () => {
    const active = pointer.current;
    pointer.current = null;
    if (active) {
      stopWork(active);
      releaseCapture(active);
    }
    if (hover.current !== null) callbacks.current.onHoverDate?.(null);
  }, []);

  if (!medicines.length) return null;

  return <section className="medicine-catalog" aria-label="Pastillas registradas">
    <div className="medicine-catalog-heading">
      <span>Tus pastillas</span>
      <small>Toca para registrar · mantén y arrastra a un día</small>
    </div>
    <div className="medicine-catalog-list">
      {medicines.map(({ name, count }) => <button
        key={name}
        type="button"
        className="medicine-catalog-pill"
        aria-label={`Registrar ${name}. ${count} ${count === 1 ? "toma registrada" : "tomas registradas"}.`}
        onPointerDown={(event) => pointerDown(event, name)}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        onLostPointerCapture={pointerCancel}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
        onClick={(event) => {
          if (event.detail !== 0 && (pointer.current || event.nativeEvent.isPrimary === false)) return;
          if (event.detail === 0 || !suppressClick.current) callbacks.current.onPick?.(name);
          suppressClick.current = false;
        }}
      >
        <Pill size={16} aria-hidden="true" />
        <span className="medicine-catalog-name">{name}</span>
        <span className="medicine-catalog-count" aria-hidden="true">{count}</span>
      </button>)}
    </div>
    {ghost && <div className="medicine-catalog-ghost" aria-hidden="true" style={{ position: "fixed", left: ghost.x, top: ghost.y, pointerEvents: "none" }}>
      <Pill size={17} />{ghost.name}
    </div>}
  </section>;
}
