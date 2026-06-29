const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const ASSETS_DIR = path.join(__dirname, '../assets');

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

function generatePlaceholder(filename, width, height, color, text) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.floor(width / 10)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(ASSETS_DIR, filename), buffer);
  console.log(`Created: ${filename} (${width}x${height})`);
}

generatePlaceholder('icon.png', 1024, 1024, '#2563eb', 'FamilyVault');
generatePlaceholder('adaptive-icon.png', 1024, 1024, '#2563eb', 'FV');
generatePlaceholder('splash.png', 1284, 2778, '#1e3a8a', 'FamilyVault Splash');
generatePlaceholder('favicon.png', 64, 64, '#2563eb', 'FV');
