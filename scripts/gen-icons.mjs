import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const svg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#2F6F5E"/>
  <text x="50%" y="58%" font-family="Vazirmatn, sans-serif" font-size="260" font-weight="800"
        fill="#EAE6D9" text-anchor="middle">د</text>
</svg>`;

mkdirSync('public', { recursive: true });

const sizes = [192, 512];
for (const size of sizes) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}.png`);
}
await sharp(Buffer.from(svg)).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('icons generated');
