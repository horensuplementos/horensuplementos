import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const image = await readFile(new URL("src/assets/og_image.png", root));
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (!image.subarray(0, 8).equals(pngSignature) || image.readUInt32BE(16) !== 1200 || image.readUInt32BE(20) !== 630) {
  throw new Error("A imagem OG oficial deve ser um PNG de 1200 × 630, conforme os metadados do site.");
}

// Publish stable URLs without altering the supplied artwork. Keep generated
// assets committed so the Lovable preview also works before a build hook runs.
for (const [source, target] of [
  ["src/assets/og_image.png", "public/og_image.png"],
  ["src/assets/horen-logo-transparent.png", "public/horen-logo.png"],
]) {
  const content = await readFile(new URL(source, root));
  const destination = new URL(target, root);
  const previous = await readFile(destination).catch(() => null);
  if (!previous?.equals(content)) await writeFile(destination, content);
}
console.log("Imagem OG oficial e logotipo sincronizados em public/.");
