import type { Photo } from "@/lib/types";

export type PreparedPhoto = { photo: Photo; file: File; filename: string };

export function supportsFileShare(
  shareNavigator: { canShare?: (data?: ShareData) => boolean; share?: (data?: ShareData) => Promise<void> },
  files: File[],
) {
  try { return Boolean(shareNavigator.share && shareNavigator.canShare?.({ files })); }
  catch { return false; }
}

export function safeFilePart(value: string) {
  const safe = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9._-]/g, "").replace(/^\.+|\.+$/g, "");
  return safe.slice(0, 48) || "Afterhours";
}

export async function preparePhotoFiles(
  photos: Photo[],
  rollName: string,
  signal: AbortSignal,
  onProgress: (done: number) => void,
) {
  const rollPart = safeFilePart(rollName);
  const contributorCounts = new Map<string, number>();
  const usedNames = new Set<string>();
  const files: PreparedPhoto[] = [];
  const failed: Photo[] = [];
  for (let index = 0; index < photos.length; index += 1) {
    if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
    const photo = photos[index];
    try {
      const response = await fetch(photo.src, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("The photo could not be fetched.");
      const blob = await response.blob();
      if (!blob.size || !/^image\/(?:jpeg|png|webp|heic|heif)$/i.test(blob.type || "image/jpeg")) {
        throw new Error("The photo format is not supported for export.");
      }
      const contributor = safeFilePart(photo.by || "A-friend");
      const key = contributor.toLocaleLowerCase("en-US");
      const sequence = (contributorCounts.get(key) ?? 0) + 1;
      contributorCounts.set(key, sequence);
      const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      let filename = `${rollPart}_${contributor}_${String(sequence).padStart(3, "0")}.${extension}`;
      let suffix = 2;
      while (usedNames.has(filename.toLocaleLowerCase("en-US"))) {
        filename = `${rollPart}_${contributor}_${String(sequence).padStart(3, "0")}-${suffix}.${extension}`;
        suffix += 1;
      }
      usedNames.add(filename.toLocaleLowerCase("en-US"));
      const file = new File([blob], filename, { type: blob.type || "image/jpeg", lastModified: Date.parse(photo.at) || Date.now() });
      files.push({ photo, file, filename });
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
      failed.push(photo);
    } finally {
      onProgress(index + 1);
    }
  }
  return { files, failed };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadOnePhoto(photo: Photo, rollName: string, index: number) {
  const response = await fetch(photo.src, { cache: "no-store" });
  if (!response.ok) throw new Error("This photo could not be downloaded. Try again.");
  const blob = await response.blob();
  const contributor = safeFilePart(photo.by || "A-friend");
  const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const filename = `${safeFilePart(rollName)}_${contributor}_${String(index + 1).padStart(3, "0")}.${extension}`;
  downloadBlob(blob, filename);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function put16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true); }
function put32(view: DataView, offset: number, value: number) { view.setUint32(offset, value, true); }

export async function createPhotoZip(items: PreparedPhoto[], groupByContributor: boolean) {
  const encoder = new TextEncoder();
  const csvRows = ["filename,contributor,uploaded_at,caption"];
  const entries: Array<{ name: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer>; crc: number; offset: number }> = [];
  for (const item of items) {
    const zipName = groupByContributor ? `${safeFilePart(item.photo.by || "A-friend")}/${item.filename}` : item.filename;
    const name = encoder.encode(zipName);
    const data = new Uint8Array(await item.file.arrayBuffer());
    const crc = crc32(data);
    entries.push({ name, data, crc, offset: 0 });
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    csvRows.push([item.filename, item.photo.by, new Date(item.photo.at).toISOString(), item.photo.caption]
      .map((value) => escapeCsv(String(value ?? ""))).join(","));
  }
  entries.push({ name: encoder.encode("photos.csv"), data: encoder.encode(csvRows.join("\r\n")), crc: 0, offset: 0 });
  entries[entries.length - 1].crc = crc32(entries[entries.length - 1].data);

  const localParts: BlobPart[] = [];
  let offset = 0;
  for (const entry of entries) {
    entry.offset = offset;
    const header = new Uint8Array(30 + entry.name.length);
    const view = new DataView(header.buffer);
    put32(view, 0, 0x04034b50); put16(view, 4, 20); put16(view, 6, 0x0800); put16(view, 8, 0);
    put16(view, 10, 0); put16(view, 12, 33);
    put32(view, 14, entry.crc); put32(view, 18, entry.data.length); put32(view, 22, entry.data.length);
    put16(view, 26, entry.name.length); put16(view, 28, 0); header.set(entry.name, 30);
    localParts.push(header, entry.data);
    offset += header.length + entry.data.length;
  }

  const centralParts: BlobPart[] = [];
  let centralSize = 0;
  for (const entry of entries) {
    const header = new Uint8Array(46 + entry.name.length);
    const view = new DataView(header.buffer);
    put32(view, 0, 0x02014b50); put16(view, 4, 20); put16(view, 6, 20); put16(view, 8, 0x0800); put16(view, 10, 0);
    put16(view, 12, 0); put16(view, 14, 33);
    put32(view, 16, entry.crc); put32(view, 20, entry.data.length); put32(view, 24, entry.data.length);
    put16(view, 28, entry.name.length); put16(view, 30, 0); put16(view, 32, 0); put16(view, 34, 0);
    put16(view, 36, 0); put32(view, 38, 0); put32(view, 42, entry.offset); header.set(entry.name, 46);
    centralParts.push(header); centralSize += header.length;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  put32(endView, 0, 0x06054b50); put16(endView, 8, entries.length); put16(endView, 10, entries.length);
  put32(endView, 12, centralSize); put32(endView, 16, offset); put16(endView, 20, 0);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}
