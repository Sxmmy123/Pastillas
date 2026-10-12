import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const buildRoot = resolve(projectRoot, "dist");

if (!existsSync(resolve(buildRoot, "index.html"))) {
  throw new Error("No se encontró dist/index.html. Ejecuta npm run build primero.");
}

for (const entry of readdirSync(buildRoot)) {
  const source = resolve(buildRoot, entry);
  const destination = resolve(projectRoot, entry);
  if (relative(projectRoot, destination).split(sep).includes("..")) {
    throw new Error("Destino de publicación fuera de la raíz del proyecto.");
  }
  if (entry === "assets" && existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true });
  }
  cpSync(source, destination, { recursive: true, force: true });
}

console.log("Build de GitHub Pages copiado a la raíz del repositorio.");
