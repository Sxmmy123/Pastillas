import { useEffect, useRef, useState } from "react";

const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

export default function useCalendarSwipe(onNavigate) {
  const element = useRef(null), gesture = useRef(null), suppressClickUntil = useRef(0);
  const navigate = useRef(onNavigate); navigate.current = onNavigate;
  const [offset, setOffset] = useState(0);

  function clear() {
    const current = gesture.current; gesture.current = null; setOffset(0);
    if (current?.axis === "horizontal") suppressClickUntil.current = performance.now() + 600;
    if (current?.source === "pointer") {
      try { if (current.element.hasPointerCapture(current.id)) current.element.releasePointerCapture(current.id); } catch {}
    }
    return current;
  }

  function start(source, id, x, y, target) {
    suppressClickUntil.current = 0;
    gesture.current = { source, id, x, y, axis: null, width: target.clientWidth, element: target };
  }

  function move(x, y) {
    const current = gesture.current;
    if (!current || current.axis === "vertical") return false;
    const dx = x - current.x, dy = y - current.y;
    if (!current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        current.axis = "horizontal";
        if (current.source === "pointer") {
          try { current.element.setPointerCapture(current.id); } catch {}
        }
      } else if (Math.abs(dy) > Math.abs(dx)) current.axis = "vertical";
    }
    if (current.axis !== "horizontal") return false;
    setOffset(Math.max(-36, Math.min(36, dx * .25)));
    return true;
  }

  function finish(x, y) {
    const current = clear();
    if (!current) return;
    const dx = x - current.x, dy = y - current.y;
    const threshold = Math.max(36, Math.min(60, current.width * .13));
    if (current.axis === "horizontal" && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.2) navigate.current(dx < 0 ? 1 : -1);
  }

  useEffect(() => {
    const viewport = element.current;
    if (!viewport) return;
    function touchStart(event) {
      if (!isMobile()) return;
      if (event.touches.length !== 1) { clear(); return; }
      const touch = event.touches[0];
      // Touch events take ownership from their compatibility pointer events.
      // Keeping the original touch target avoids capture transfers between days.
      start("touch", touch.identifier, touch.clientX, touch.clientY, viewport);
    }
    function touchMove(event) {
      if (gesture.current?.source !== "touch") return;
      if (event.touches.length !== 1) { clear(); return; }
      const touch = Array.from(event.touches).find((item) => item.identifier === gesture.current.id);
      if (touch && move(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
    }
    function touchEnd(event) {
      if (gesture.current?.source !== "touch") return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === gesture.current.id);
      if (touch) finish(touch.clientX, touch.clientY);
    }
    function touchCancel() { if (gesture.current?.source === "touch") clear(); }
    viewport.addEventListener("touchstart", touchStart, { passive: true });
    viewport.addEventListener("touchmove", touchMove, { passive: false });
    viewport.addEventListener("touchend", touchEnd, { passive: true });
    viewport.addEventListener("touchcancel", touchCancel, { passive: true });
    return () => {
      viewport.removeEventListener("touchstart", touchStart);
      viewport.removeEventListener("touchmove", touchMove);
      viewport.removeEventListener("touchend", touchEnd);
      viewport.removeEventListener("touchcancel", touchCancel);
      gesture.current = null;
    };
  }, []);

  return {
    ref: element,
    style: { "--swipe-offset": offset + "px" },
    onPointerDown(event) {
      if (!event.isPrimary) { clear(); return; }
      if (!isMobile() || event.button !== 0 || gesture.current?.source === "touch") return;
      start("pointer", event.pointerId, event.clientX, event.clientY, event.currentTarget);
    },
    onPointerMove(event) {
      if (gesture.current?.source !== "pointer" || gesture.current.id !== event.pointerId) return;
      if (move(event.clientX, event.clientY)) event.preventDefault();
    },
    onPointerUp(event) {
      if (gesture.current?.source === "pointer" && gesture.current.id === event.pointerId) finish(event.clientX, event.clientY);
    },
    onPointerCancel(event) {
      if (gesture.current?.source === "pointer" && gesture.current.id === event.pointerId) clear();
    },
    onLostPointerCapture(event) {
      // A child's implicit capture can bubble here when capture moves to us.
      if (event.target === event.currentTarget && gesture.current?.source === "pointer" && gesture.current.id === event.pointerId) clear();
    },
    onClickCapture(event) {
      if (event.detail !== 0 && performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
    },
    onKeyDown(event) {
      if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault(); navigate.current(event.key === "ArrowLeft" ? -1 : 1);
    },
  };
}
