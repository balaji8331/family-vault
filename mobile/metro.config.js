const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /node_modules\/tesseract\.js\/.*/,
  /node_modules\/browser-image-compression\/.*/,
  /node_modules\/pdf-lib\/.*/,
  /node_modules\/@upstash\/redis\/.*/,
  /node_modules\/@upstash\/ratelimit\/.*/,
];

config.maxWorkers = 2;

module.exports = config;
