import { medicineMark } from "./medicineVisual";

export default function MedicineMark({ name, small = false }) {
  const style = medicineMark(name);
  return <span className={"medicine-mark " + style.tone + (small ? " small" : "")} aria-hidden="true">
    {style.shape === "cap" ? <svg viewBox="0 0 48 48"><g transform="rotate(-38 24 24)"><rect x="8" y="15" width="32" height="18" rx="9" fill="currentColor" /><path d="M24 15v18" stroke="white" strokeOpacity=".8" strokeWidth="2" /><path d="M24 16h7a8 8 0 0 1 0 16h-7z" fill="white" fillOpacity=".55" /></g></svg> : <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="currentColor" /><path d="M14 24h20" stroke="white" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" /></svg>}
  </span>;
}
