import { nativeImage } from "electron";
import { deflateSync } from "node:zlib";

function png(width: number, height: number, paint: (x: number, y: number) => number): Buffer {
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = paint(x, y);
      const i = (y * width + x) * 4;
      raw[i] = 0;
      raw[i + 1] = 0;
      raw[i + 2] = 0;
      raw[i + 3] = alpha;
    }
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk("IHDR", Buffer.from([
    0, 0, 0, width,
    0, 0, 0, height,
    8, 6, 0, 0, 0,
  ]));
  const stride = width * 4 + 1;
  const filtered = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    filtered[y * stride] = 0;
    raw.copy(filtered, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = chunk("IDAT", deflateSync(filtered));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcSource = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcSource));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function deck(kind: "idle" | "building" | "failed"): Buffer {
  return png(16, 16, (x, y) => {
    const layers = [
      { y0: 10, y1: 12 },
      { y0: 7, y1: 9 },
      { y0: 4, y1: 6 },
    ];
    for (const layer of layers) {
      if (x >= 3 && x <= 12 && y >= layer.y0 && y <= layer.y1) return 230;
    }
    if (kind === "building" && x >= 7 && x <= 8 && y >= 1 && y <= 3) return 230;
    if (kind === "failed" && ((x === y && x >= 1 && x <= 4) || (x + y === 5 && x <= 4))) return 230;
    return 0;
  });
}

export function trayImage(kind: "idle" | "building" | "failed") {
  const image = nativeImage.createFromBuffer(deck(kind), { width: 16, height: 16 });
  image.setTemplateImage(true);
  return image;
}
