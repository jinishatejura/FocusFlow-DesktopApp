const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a basic 64x64 RGBA PNG with an indigo/cyan focus ring
function createPng(width, height, isTray = false) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (rowSize + 1));

  let offset = 0;
  const cx = width / 2;
  const cy = height / 2;
  const rOuter = width * 0.44;
  const rInner = width * 0.32;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // PNG filter byte (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= rOuter && dist >= rInner) {
        if (isTray) {
          // Pure white/black for macOS template tray
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 240;
        } else {
          // Gradient cyan / purple
          const t = (x + y) / (width + height);
          rawData[offset++] = Math.floor(99 * (1 - t) + 168 * t); // R
          rawData[offset++] = Math.floor(102 * (1 - t) + 85 * t);  // G
          rawData[offset++] = 255;                                // B
          rawData[offset++] = 255;                                // A
        }
      } else if (dist < rInner * 0.6) {
        // Inner play triangle or dot
        if (isTray) {
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 220;
        } else {
          rawData[offset++] = 56;
          rawData[offset++] = 189;
          rawData[offset++] = 248; // cyan
          rawData[offset++] = 255;
        }
      } else {
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0; // transparent
      }
    }
  }

  // PNG header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC-32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const assetsDir = path.join(__dirname, '../renderer/assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(path.join(assetsDir, 'icon.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), createPng(32, 32, true));
console.log('Generated app icons successfully in', assetsDir);
