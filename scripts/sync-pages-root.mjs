import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { relative, resolve, sep } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const buildRoot = resolve(projectRoot, "dist");

if (!existsSync(resolve(buildRoot, "index.html"))) {
  throw new Error("No se encontró dist/index.html. Ejecuta npm run build primero.");
}

// Cache this release's compiled files on installation, including the first visit.
// A release-specific cache updates the app shell without touching LocalStorage.
const assets = readdirSync(resolve(buildRoot, "assets")).sort();
const release = createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 12);
const shell = ["./", "./manifest.webmanifest", "./icon.svg", ...assets.map((name) => "./assets/" + name)];
const workerPath = resolve(buildRoot, "sw.js");
const worker = readFileSync(workerPath, "utf8")
  .replace(/const CACHE = .*?;/, "const CACHE = " + JSON.stringify("pastillas-shell-" + release) + ";")
  .replace(/const SHELL = .*?;/, "const SHELL = " + JSON.stringify(shell) + ";");
writeFileSync(workerPath, worker);

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
