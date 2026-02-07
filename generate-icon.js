const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" fill="#0a0a0a"/>
  <rect x="60" y="60" width="136" height="160" rx="16" fill="none" stroke="#4fd1c5" stroke-width="10"/>
  <rect x="90" y="40" width="76" height="36" rx="10" fill="#0a0a0a" stroke="#4fd1c5" stroke-width="10"/>
  <line x1="90" y1="120" x2="166" y2="120" stroke="#4fd1c5" stroke-width="8" stroke-linecap="round" opacity="0.7"/>
  <line x1="90" y1="150" x2="150" y2="150" stroke="#4fd1c5" stroke-width="8" stroke-linecap="round" opacity="0.5"/>
  <line x1="90" y1="180" x2="135" y2="180" stroke="#4fd1c5" stroke-width="8" stroke-linecap="round" opacity="0.3"/>
</svg>`;

// Create a minimal ICO file manually
function createIco(pngBuffers) {
    // ICO file format:
    // Header (6 bytes) + Directory entries (16 bytes each) + PNG data
    const numImages = pngBuffers.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    const dirSize = dirEntrySize * numImages;

    let dataOffset = headerSize + dirSize;
    const entries = [];

    for (const { buffer, size } of pngBuffers) {
        entries.push({
            buffer,
            size: size >= 256 ? 0 : size, // 0 means 256
            offset: dataOffset
        });
        dataOffset += buffer.length;
    }

    const totalSize = dataOffset;
    const ico = Buffer.alloc(totalSize);

    // Header
    ico.writeUInt16LE(0, 0);      // Reserved
    ico.writeUInt16LE(1, 2);      // Type: 1 = ICO
    ico.writeUInt16LE(numImages, 4); // Number of images

    // Directory entries
    let offset = headerSize;
    for (const entry of entries) {
        ico.writeUInt8(entry.size, offset);     // Width
        ico.writeUInt8(entry.size, offset + 1); // Height
        ico.writeUInt8(0, offset + 2);          // Color palette
        ico.writeUInt8(0, offset + 3);          // Reserved
        ico.writeUInt16LE(1, offset + 4);       // Color planes
        ico.writeUInt16LE(32, offset + 6);      // Bits per pixel
        ico.writeUInt32LE(entry.buffer.length, offset + 8);  // Image size
        ico.writeUInt32LE(entry.offset, offset + 12);        // Image offset
        offset += dirEntrySize;
    }

    // Image data
    for (const entry of entries) {
        entry.buffer.copy(ico, entry.offset);
    }

    return ico;
}

async function generate() {
    const svgBuffer = Buffer.from(SVG);
    const sizes = [16, 32, 48, 64, 128, 256];

    // Generate PNG at 256x256 for Electron
    const png256 = await sharp(svgBuffer).resize(256, 256).png().toBuffer();
    fs.writeFileSync(path.join(__dirname, 'icon.png'), png256);
    console.log('Created icon.png (256x256)');

    // Generate multiple PNGs for ICO
    const pngBuffers = [];
    for (const size of sizes) {
        const buf = await sharp(svgBuffer).resize(size, size).png().toBuffer();
        pngBuffers.push({ buffer: buf, size });
    }

    const icoBuffer = createIco(pngBuffers);
    fs.writeFileSync(path.join(__dirname, 'icon.ico'), icoBuffer);
    console.log('Created icon.ico with sizes:', sizes.join(', '));
}

generate().catch(console.error);
