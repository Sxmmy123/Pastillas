import { isNamedMedicine, norm } from "./calendar.js";

const COLORS = ["mint", "coral", "blue", "lavender", "sun", "teal"];
export const MEDICINE_COLORS = {
  mint: "#57a67b", coral: "#d58b78", blue: "#709dbc",
  lavender: "#a08bbb", sun: "#c5a24f", teal: "#58a49b", neutral: "#94a49a",
};

// The shape is a visual label, not an identification of a physical medicine.
export function medicineMark(name) {
  const value = norm(name); let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return {
    tone: !isNamedMedicine(name) ? "neutral" : COLORS[Math.abs(hash) % COLORS.length],
    shape: !isNamedMedicine(name) || /capsula|capsule|gelcap/.test(value) ? "cap"
      : /pastilla|tableta|comprimido|tablet/.test(value) ? "tab" : Math.abs(hash >> 3) % 2 ? "cap" : "tab",
  };
}
