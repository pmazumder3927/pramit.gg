// Server-side image dimension probing for post bodies. Inline markdown images
// historically shipped as bare <img> with no width/height, so every image that
// finished loading mid-read reflowed the journal sheet under the reader. At
// ISR render time we sniff each image's intrinsic size from its first bytes
// (Range request — a PNG header is 24 bytes) and emit real dimensions.

export type ImageDims = { width: number; height: number };

const MD_IMG = /!\[[^\]]*\]\(\s*<?([^)\s>]+)/g;
const HTML_IMG = /<img[^>]+src=["']([^"']+)["']/gi;

export function extractImageUrls(markdown: string): string[] {
  const urls = new Set<string>();
  for (const re of [MD_IMG, HTML_IMG]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown))) {
      if (/^https?:\/\//i.test(m[1])) urls.add(m[1]);
    }
  }
  return Array.from(urls);
}

function parseDims(buf: Uint8Array): ImageDims | null {
  // PNG: IHDR width/height at fixed offsets
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  // GIF: little-endian logical screen size
  if (
    buf.length >= 10 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46
  ) {
    return { width: buf[6] | (buf[7] << 8), height: buf[8] | (buf[9] << 8) };
  }
  // JPEG: walk markers to the first SOFn frame header
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      // standalone markers with no length segment
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      const len = (buf[i + 2] << 8) | buf[i + 3];
      const isSOF =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSOF) {
        return {
          height: (buf[i + 5] << 8) | buf[i + 6],
          width: (buf[i + 7] << 8) | buf[i + 8],
        };
      }
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  // WebP: RIFF container, dimensions depend on the chunk flavor
  if (
    buf.length >= 30 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    const fourcc = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (fourcc === "VP8X") {
      return {
        width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
      };
    }
    if (fourcc === "VP8 ") {
      return {
        width: (buf[26] | (buf[27] << 8)) & 0x3fff,
        height: (buf[28] | (buf[29] << 8)) & 0x3fff,
      };
    }
    if (fourcc === "VP8L") {
      const bits =
        buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
  }
  return null;
}

// 256KB covers PNG/GIF/WebP (headers only) and effectively every JPEG,
// including ones with a fat EXIF blob before the SOF marker.
const PROBE_BYTES = 262144;

async function probeOne(url: string): Promise<ImageDims | null> {
  const res = await fetch(url, {
    headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok || !res.body) return null;
  // Read at most PROBE_BYTES even when the server ignores Range and streams
  // the whole file — never buffer a multi-MB image into the render.
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < PROBE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return parseDims(buf);
}

// Per-instance memo of in-flight/settled probes — concurrent renders share one
// fetch, warm-lambda regenerations skip it entirely, and a transient failure
// is retried on the next render instead of poisoning the entry.
const memo = new Map<string, Promise<ImageDims | null>>();

export async function probeImageDims(
  urls: string[],
): Promise<Record<string, ImageDims>> {
  const out: Record<string, ImageDims> = {};
  await Promise.all(
    urls.map(async (url) => {
      let probe = memo.get(url);
      if (!probe) {
        probe = probeOne(url).catch(() => null);
        memo.set(url, probe);
        void probe.then((dims) => {
          if (!dims) memo.delete(url);
        });
      }
      const dims = await probe;
      if (dims && dims.width > 0 && dims.height > 0) out[url] = dims;
    }),
  );
  return out;
}
