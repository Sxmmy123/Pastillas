import { useRef, useState } from "react";

export default function useCalendarSwipe(onNavigate) {
  const gesture = useRef(null), suppressClickUntil = useRef(0);
  const [offset, setOffset] = useState(0);
  function clear(event) {
    const current = gesture.current; gesture.current = null; setOffset(0);
    if (current?.axis === "horizontal") suppressClickUntil.current = performance.now() + 600;
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    return current;
  }
  return {
    style: { "--swipe-offset": offset + "px" },
    onPointerDown(event) {
      suppressClickUntil.current = 0;
      if (!event.isPrimary) { gesture.current = null; setOffset(0); return; }
      if (event.pointerType === "mouse" || !window.matchMedia("(max-width: 760px)").matches) return;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, width: event.currentTarget.clientWidth };
    },
    onPointerMove(event) {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId || current.axis === "vertical") return;
      const dx = event.clientX - current.x, dy = event.clientY - current.y;
      if (!current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
        if (Math.abs(dx) > Math.abs(dy) * 1.3) {
          current.axis = "horizontal";
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
        } else if (Math.abs(dy) > Math.abs(dx)) current.axis = "vertical";
      }
      if (current.axis === "horizontal") setOffset(Math.max(-30, Math.min(30, dx * .2)));
    },
    onPointerUp(event) {
      if (gesture.current?.id !== event.pointerId) return;
      const current = clear(event), dx = event.clientX - current.x, dy = event.clientY - current.y;
      const threshold = Math.max(44, Math.min(72, current.width * .15));
      if (current.axis === "horizontal" && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.3) onNavigate(dx < 0 ? 1 : -1);
    },
    onPointerCancel(event) { if (gesture.current?.id === event.pointerId) clear(event); },
    onLostPointerCapture(event) { if (gesture.current?.id === event.pointerId) clear(event); },
    onClickCapture(event) {
      if (event.detail !== 0 && performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
    },
    onKeyDown(event) {
      if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault(); onNavigate(event.key === "ArrowLeft" ? -1 : 1);
    },
  };
}
