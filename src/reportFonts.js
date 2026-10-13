import regularUrl from "./assets/fonts/Atkinson-Regular.ttf?url";
import boldUrl from "./assets/fonts/Atkinson-Bold.ttf?url";

let loading;
async function base64Font(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("No se pudo cargar la tipografía del PDF. Vuelve a intentarlo.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let value = "";
  for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
}
export function loadReportFonts() {
  if (!loading) loading = Promise.all([base64Font(regularUrl), base64Font(boldUrl)])
    .then(([regular, bold]) => ({ regular, bold })).catch((error) => { loading = null; throw error; });
  return loading;
}
