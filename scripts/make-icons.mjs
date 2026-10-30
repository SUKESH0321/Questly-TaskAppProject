/**
 * Renders the Questly app icons (PWA / iPhone / Android) from the gold coin (icon_Q.png).
 *   npm run icons
 * Output goes to public/icons. The coin is pixel art, so it is enlarged with
 * nearest-neighbour scaling to keep its edges sharp. Re-run after changing icon_Q.png.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const CORAL = { r: 0xdd, g: 0x38, b: 0x13, alpha: 1 };
const outDir = path.resolve("public/icons");
fs.mkdirSync(outDir, { recursive: true });
const coin = fs.readFileSync(path.resolve("icon_Q.png"));

/** Coral square with the coin centred at `coinSize` px (a whole multiple of 32 stays crisp). */
async function render(size, coinSize, file) {
  const scaled = await sharp(coin).resize(coinSize, coinSize, { kernel: "nearest" }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: CORAL } })
    .composite([{ input: scaled, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, file));
}

await Promise.all([
  render(192, 128, "icon-192.png"),
  render(512, 320, "icon-512.png"),
  // Android crops "maskable" icons into circles, so keep the coin inside the safe zone.
  render(512, 256, "maskable-512.png"),
  render(180, 96, "apple-touch-icon.png"),
]);
console.log("Icons written to public/icons");
