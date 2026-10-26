import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(root, "public");
const dataDir = resolve(root, "database");
const dataFile = resolve(dataDir, "rsvps.json");
let writeQueue = Promise.resolve();
const attempts = new Map();
const mimeTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  try { await readFile(dataFile, "utf8"); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(dataFile, "[]\n", "utf8");
  }
}
async function readRows() {
  await ensureDataFile();
  const rows = JSON.parse(await readFile(dataFile, "utf8"));
  if (!Array.isArray(rows)) throw new Error("Database JSON harus berupa array.");
  return rows;
}
function updateRows(update) {
  const task = writeQueue.then(async () => {
    const rows = await readRows();
    const result = await update(rows);
    if (result.changed) {
      const temp = `${dataFile}.${randomUUID()}.tmp`;
      await writeFile(temp, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
      await rename(temp, dataFile);
    }
    return result.value;
  });
  writeQueue = task.catch(() => {});
  return task;
}
function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Format formulir tidak valid." };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) return { error: "Identitas pengiriman tidak valid. Muat ulang halaman." };
  if (name.length < 2 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return { error: "Nama harus terdiri dari 2–80 karakter." };
  if (!["hadir", "tidak_hadir", "ragu"].includes(body.attendance)) return { error: "Pilih konfirmasi kehadiran terlebih dahulu." };
  if (!Number.isInteger(body.guestCount) || (body.attendance === "tidak_hadir" ? body.guestCount !== 0 : body.guestCount < 1 || body.guestCount > 4)) return { error: "Jumlah tamu harus 1–4 orang, atau 0 jika tidak hadir." };
  if ((body.message !== undefined && typeof body.message !== "string") || message.length > 500 || (body.isPublic !== undefined && typeof body.isPublic !== "boolean") || (body.isAttendancePublic !== undefined && typeof body.isAttendancePublic !== "boolean") || body.website) return { error: "Periksa kembali formulir. Ucapan maksimal 500 karakter." };
  return { value: { id: body.id, name, attendance: body.attendance, guest_count: body.guestCount, message, is_public: body.isPublic === true && message.length > 0, is_attendance_public: body.isAttendancePublic !== false, created_at: new Date().toISOString() } };
}
function sendJson(res, code, value) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}
function commonHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data:; img-src 'self' data: https://0.soompi.io; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
}
async function readJsonBody(req, res) {
  if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
    sendJson(res, 415, { error: "Gunakan format JSON." }); return null;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) { sendJson(res, 413, { error: "Ukuran formulir terlalu besar." }); return null; }
    chunks.push(chunk);
  }
  try { const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); return parsed === null ? { invalid: true } : parsed; }
  catch { sendJson(res, 400, { error: "Format JSON tidak valid." }); return null; }
}
async function api(req, res, url) {
  res.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/api/health" && req.method === "GET") {
    try { const rows = await readRows(); return sendJson(res, 200, { database: "json-file", status: "connected", records: rows.length }); }
    catch { return sendJson(res, 503, { database: "json-file", status: "unavailable" }); }
  }
  if (url.pathname === "/api/attendees" && req.method === "GET") {
    try {
      const rows = await readRows();
      const attendees = rows.filter((row) => row.is_attendance_public !== false).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(({ name, attendance, guest_count, created_at }) => ({ name, attendance, guest_count, created_at }));
      return sendJson(res, 200, { attendees });
    } catch { return sendJson(res, 503, { error: "Daftar konfirmasi belum dapat dimuat. Coba lagi." }); }
  }
  if (url.pathname === "/api/wishes" && req.method === "GET") {
    try {
      const rows = await readRows();
      const wishes = rows.filter((row) => row.is_public && row.message).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 12).map(({ name, message, created_at }) => ({ name, message, created_at }));
      return sendJson(res, 200, { wishes });
    } catch { return sendJson(res, 503, { error: "Ucapan belum dapat dimuat. Silakan coba lagi." }); }
  }
  if (url.pathname === "/api/rsvp" && req.method === "POST") {
    const origin = req.headers.origin;
    if (origin) {
      try { if (new URL(origin).host !== req.headers.host) return sendJson(res, 403, { error: "Asal permintaan tidak diizinkan." }); }
      catch { return sendJson(res, 403, { error: "Asal permintaan tidak valid." }); }
    }
    const ip = req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const previous = attempts.get(ip);
    const attempt = previous && previous.until > now ? previous : { count: 0, until: now + 600000 };
    if (++attempt.count > 10) {
      res.setHeader("Retry-After", String(Math.ceil((attempt.until - now) / 1000)));
      return sendJson(res, 429, { error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." });
    }
    if (attempts.size >= 1000 && !attempts.has(ip)) attempts.delete(attempts.keys().next().value);
    attempts.set(ip, attempt);
    const body = await readJsonBody(req, res);
    if (body === null) return;
    const { value, error } = validate(body);
    if (error) return sendJson(res, 400, { error });
    try {
      const saved = await updateRows(async (rows) => {
        if (rows.some((row) => row.id === value.id)) return { changed: false, value: false };
        rows.push(value);
        return { changed: true, value: true };
      });
      return sendJson(res, saved ? 201 : 200, { message: saved ? "Konfirmasi berhasil tersimpan. Terima kasih! ♡" : "Konfirmasi ini sudah tersimpan sebelumnya. ♡" });
    } catch { return sendJson(res, 503, { error: "Konfirmasi belum tersimpan. Isianmu tetap ada; silakan coba lagi." }); }
  }
  return sendJson(res, 404, { error: "Endpoint tidak ditemukan." });
}
async function handle(req, res) {
  commonHeaders(res);
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || "localhost"}`); }
  catch { res.writeHead(400); return res.end("URL tidak valid."); }
  if (url.pathname.startsWith("/api/")) return api(req, res, url);
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }); return res.end("Method not allowed.");
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); return res.end("Path tidak valid."); }
  if (pathname === "/") pathname = "/index.html";
  if (pathname.split("/").some((part) => part.startsWith("."))) { res.writeHead(404); return res.end("Tidak ditemukan."); }
  const file = resolve(publicRoot, `.${pathname}`);
  if (file !== publicRoot && !file.startsWith(publicRoot + sep)) { res.writeHead(403); return res.end("Tidak diizinkan."); }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Not a file");
    res.writeHead(200, { "Content-Type": mimeTypes[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": pathname === "/index.html" ? "no-cache" : "public, max-age=3600" });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("File tidak ditemukan."); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await ensureDataFile();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  const server = createServer((req, res) => { handle(req, res).catch(() => { if (!res.headersSent) sendJson(res, 500, { error: "Terjadi gangguan. Silakan coba lagi." }); else res.destroy(); }); });
  server.listen(port, host, () => {
    console.log(`My Demon Wedding siap di http://${host}:${port}`);
    console.log(`Database RSVP: ${dataFile}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
