import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Rasterize the code-native H monogram. This is a local maintenance command;
// Lovable builds use the committed icons and do not require a browser binary.
const root = new URL("../public/", import.meta.url);
const svg = await readFile(new URL("favicon.svg", root), "utf8");
await mkdir(new URL("icons/", root), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const [size, filename] of [
    [32, "favicon-32x32.png"],
    [180, "apple-touch-icon.png"],
    [192, "icons/icon-192x192.png"],
    [512, "icons/icon-512x512.png"],
    [256, "favicon.ico"],
  ]) {
    const data = await page.evaluate(async ({ svg, size }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL("image/png").split(",")[1];
    }, { svg, size });
    const png = Buffer.from(data, "base64");
    if (filename.endsWith(".ico")) {
      const header = Buffer.alloc(22);
      header.writeUInt16LE(1, 2); // ICO image type
      header.writeUInt16LE(1, 4); // one 256 × 256 PNG entry (zero encodes 256)
      header.writeUInt16LE(1, 10);
      header.writeUInt16LE(32, 12);
      header.writeUInt32LE(png.length, 14);
      header.writeUInt32LE(22, 18);
      await writeFile(new URL(filename, root), Buffer.concat([header, png]));
    } else {
      await writeFile(new URL(filename, root), png);
    }
  }
} finally {
  await browser.close();
}
console.log("Favicons, ícone Apple e ícones do manifest gerados.");
