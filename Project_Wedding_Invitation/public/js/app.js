const $ = (selector) => document.querySelector(selector);
const eventStart = new Date("2026-11-22T08:00:00+07:00");
const eventEnd = new Date("2026-11-22T14:00:00+07:00");
const guest = new URLSearchParams(location.search).get("to")?.trim().slice(0, 80);

if (guest) {
  $("#guest-name").textContent = guest;
  $("#name").value = guest;
}

function updateCountdown() {
  const now = Date.now();
  const remaining = Math.max(0, eventStart.getTime() - now);
  const units = [
    Math.floor(remaining / 86400000),
    Math.floor(remaining / 3600000) % 24,
    Math.floor(remaining / 60000) % 60,
    Math.floor(remaining / 1000) % 60,
  ];
  ["days", "hours", "minutes", "seconds"].forEach((id, index) => {
    $(`#${id}`).textContent = String(units[index]).padStart(2, "0");
  });
  if (now >= eventStart.getTime()) {
    $("#countdown-status").textContent = now < eventEnd.getTime()
      ? "Hari bahagia kami telah tiba. Sampai jumpa di sana! ♡"
      : "Hari istimewa telah berlalu. Terima kasih untuk setiap doa dan kehadiranmu. ♡";
    $("#countdown").setAttribute("aria-label", now < eventEnd.getTime() ? "Acara sedang berlangsung." : "Acara telah selesai.");
  }
}
updateCountdown();
setInterval(updateCountdown, 1000);

$("#save-date").addEventListener("click", () => {
  const utc = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calendar = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//My Demon Wedding//Do Do-hee Jung Gu-won//ID",
    "CALSCALE:GREGORIAN", "BEGIN:VEVENT", "UID:do-dohee-jung-guwon-20261122@mydemonwedding.local",
    `DTSTAMP:${utc(new Date())}`, `DTSTART:${utc(eventStart)}`, `DTEND:${utc(eventEnd)}`,
    "SUMMARY:Wedding Scrapbook — Do Do-hee & Jung Gu-won (fan-made)",
    "LOCATION:Yogyakarta, Indonesia (venue fiktif)",
    "DESCRIPTION:Undangan fan-made untuk tugas akademik. Akad 08.00-09.00 WIB; resepsi 11.00-14.00 WIB.",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "do-dohee-jung-guwon-22-november-2026.ics";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("#calendar-status").textContent = "Buka file kalender yang diunduh untuk menyimpan tanggal.";
});

const music = $("#background-music");
const musicButtons = document.querySelectorAll("[data-music-toggle]");
function syncMusic() {
  const playing = !music.paused;
  musicButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(playing));
    button.setAttribute("aria-label", playing ? "Jeda musik instrumental" : "Putar musik instrumental");
  });
  $("#music-label").textContent = playing ? "Musik menyala" : "Putar musik";
  $("#playlist-label").textContent = playing ? "Jeda cerita kita" : "Putar cerita kita";
  $("#playlist-icon").textContent = playing ? "Ⅱ" : "▶";
}
async function toggleMusic() {
  if (music.paused) {
    try { music.volume = 0.3; await music.play(); }
    catch (error) { if (error.name !== "AbortError") $("#music-label").textContent = "Coba putar lagi"; }
  } else music.pause();
}
musicButtons.forEach((button) => button.addEventListener("click", toggleMusic));
music.addEventListener("play", syncMusic);
music.addEventListener("pause", syncMusic);
music.addEventListener("error", () => {
  $("#music-label").textContent = "Musik tidak tersedia";
  $("#playlist-label").textContent = "Musik tidak tersedia";
});
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
music.addEventListener("loadedmetadata", () => { if (Number.isFinite(music.duration)) $("#track-duration").textContent = formatTime(music.duration); });
music.addEventListener("timeupdate", () => {
  $("#track-current").textContent = formatTime(music.currentTime);
  $("#music-progress").value = music.duration > 0 ? music.currentTime / music.duration : 0;
});

const photoDialog = $("#photo-dialog");
const photoButtons = [...document.querySelectorAll(".gallery-photo")];
let photoIndex = 0;
function showPhoto(index) {
  photoIndex = (index + photoButtons.length) % photoButtons.length;
  const selected = photoButtons[photoIndex];
  $("#dialog-photo").className = `photo photo-${selected.dataset.photo}`;
  $("#dialog-photo").setAttribute("aria-label", selected.dataset.caption);
  $("#dialog-caption").textContent = selected.dataset.caption;
  $("#photo-counter").textContent = `0${photoIndex + 1} / 04`;
}
function openDialog(dialog) { dialog.showModal(); document.body.classList.add("dialog-open"); }
photoButtons.forEach((button, index) => button.addEventListener("click", () => { showPhoto(index); openDialog(photoDialog); }));
$("#previous-photo").addEventListener("click", () => showPhoto(photoIndex - 1));
$("#next-photo").addEventListener("click", () => showPhoto(photoIndex + 1));
photoDialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") { event.preventDefault(); showPhoto(photoIndex - 1); }
  if (event.key === "ArrowRight") { event.preventDefault(); showPhoto(photoIndex + 1); }
});
$("#open-letter").addEventListener("click", () => openDialog($("#letter-dialog")));
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
});

const form = $("#rsvp-form");
const attendance = $("#attendance");
const guestCount = $("#guest-count");
const status = $("#form-status");
let sending = false;
let sent = false;
const submissionId = crypto.randomUUID();
function syncGuests() {
  const absent = attendance.value === "tidak_hadir";
  if (absent && !guestCount.querySelector('[value="0"]')) {
    guestCount.add(new Option("Tidak hadir", "0"));
    guestCount.value = "0";
  } else if (!absent) {
    guestCount.querySelector('[value="0"]')?.remove();
    if (!guestCount.value) guestCount.value = "1";
  }
  guestCount.disabled = absent || sent;
}
attendance.addEventListener("change", syncGuests);
$("#message").addEventListener("input", () => { $("#message-count").textContent = `${$("#message").value.length} / 500`; });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (sending || sent) return;
  $("#name").value = $("#name").value.trim();
  form.classList.add("was-validated");
  if (!form.checkValidity()) {
    status.className = "form-status error";
    status.textContent = "Ada isian yang perlu dilengkapi. Periksa bagian yang ditandai.";
    form.querySelector(":invalid")?.focus();
    return;
  }
  sending = true;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  $("#submit-label").textContent = "Menyimpan konfirmasi…";
  status.className = "form-status";
  status.textContent = "Menyimpan RSVP ke database file…";
  const payload = {
    id: submissionId,
    name: $("#name").value,
    attendance: attendance.value,
    guestCount: Number(guestCount.value),
    message: $("#message").value.trim(),
    isPublic: $("#is-public").checked,
    isAttendancePublic: $("#is-attendance-public").checked,
    website: $("#website").value,
  };
  try {
    const response = await fetch("/api/rsvp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Konfirmasi belum tersimpan. Silakan coba lagi.");
    sent = true;
    status.className = "form-status success";
    status.textContent = data.message;
    $("#submit-label").textContent = "Konfirmasi tersimpan ✓";
    form.querySelectorAll("input, select, textarea").forEach((input) => { input.disabled = true; });
    await loadAttendees();
    if (payload.isPublic && payload.message) await loadWishes();
  } catch (error) {
    status.className = "form-status error";
    status.textContent = ["TimeoutError", "AbortError"].includes(error.name) || error instanceof TypeError
      ? "Koneksi ke server terputus. Isianmu tetap ada; jalankan server lalu coba lagi."
      : error.message;
  } finally {
    sending = false;
    button.disabled = sent;
    if (!sent) $("#submit-label").textContent = "Coba kirim kembali";
  }
});

let wishesLoading = false;
async function loadWishes() {
  if (wishesLoading) return;
  wishesLoading = true;
  const reloadButton = $("#refresh-wishes");
  reloadButton.disabled = true;
  const container = $("#wishes-list");
  const state = $("#wishes-status");
  state.hidden = false;
  state.textContent = "Memuat ucapan dari database…";
  try {
    const response = await fetch("/api/wishes", { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Ucapan belum dapat dimuat.");
    const fragment = document.createDocumentFragment();
    for (const wish of data.wishes) {
      const column = document.createElement("div"); column.className = "col-md-6 col-lg-4";
      const card = document.createElement("article"); card.className = "wish-card";
      const quote = document.createElement("span"); quote.className = "wish-quote"; quote.setAttribute("aria-hidden", "true"); quote.textContent = "“";
      const message = document.createElement("blockquote"); message.textContent = wish.message;
      const name = document.createElement("p"); name.className = "wish-author"; name.textContent = wish.name;
      const time = document.createElement("time"); const date = new Date(wish.created_at);
      if (!Number.isNaN(date.getTime())) {
        time.dateTime = date.toISOString();
        time.textContent = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(date);
      }
      card.append(quote, message, name, time); column.append(card); fragment.append(column);
    }
    container.replaceChildren(fragment);
    state.textContent = "Buku ucapan masih kosong. Tinggalkan doa melalui formulir di atas. ♡";
    state.hidden = data.wishes.length > 0;
  } catch {
    state.textContent = "Buku ucapan belum dapat dimuat. Ketuk “Muat ulang ucapan” untuk mencoba lagi.";
  } finally { wishesLoading = false; reloadButton.disabled = false; }
}
$("#refresh-wishes").addEventListener("click", loadWishes);

let attendeesLoading = false;
async function loadAttendees() {
  if (attendeesLoading) return;
  attendeesLoading = true;
  const refresh = $("#refresh-attendees");
  const container = $("#attendance-list");
  const state = $("#attendees-status");
  if (refresh) refresh.disabled = true;
  state.hidden = false;
  state.textContent = "Memuat daftar konfirmasi…";
  try {
    const response = await fetch("/api/attendees", { signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Daftar konfirmasi belum dapat dimuat.");
    const fragment = document.createDocumentFragment();
    for (const person of data.attendees) {
      const column = document.createElement("div"); column.className = "col-sm-6 col-lg-4";
      const card = document.createElement("article"); card.className = "attendance-card";
      const name = document.createElement("h3"); name.className = "attendance-name"; name.textContent = person.name;
      const meta = document.createElement("div"); meta.className = "attendance-meta";
      const badge = document.createElement("span");
      const labels = { hadir: "Hadir", tidak_hadir: "Tidak hadir", ragu: "Masih memastikan" };
      badge.className = `attendance-badge ${person.attendance === "tidak_hadir" ? "absent" : person.attendance === "ragu" ? "unsure" : ""}`.trim();
      badge.textContent = labels[person.attendance] || "Terkonfirmasi";
      const date = document.createElement("time");
      const created = new Date(person.created_at);
      if (!Number.isNaN(created.getTime())) {
        date.dateTime = created.toISOString();
        date.textContent = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(created);
      }
      meta.append(badge, date); card.append(name, meta);
      if (person.attendance !== "tidak_hadir") {
        const guestLine = document.createElement("p"); guestLine.className = "attendance-count";
        guestLine.textContent = `${person.guest_count} orang`;
        card.append(guestLine);
      }
      column.append(card); fragment.append(column);
    }
    container.replaceChildren(fragment);
    state.textContent = "Belum ada konfirmasi yang dibagikan. RSVP pertama akan muncul di sini. ♡";
    state.hidden = data.attendees.length > 0;
  } catch {
    state.textContent = "Daftar belum dapat dimuat. Pastikan server berjalan, lalu muat ulang.";
  } finally { attendeesLoading = false; if (refresh) refresh.disabled = false; }
}
$("#refresh-attendees").addEventListener("click", loadAttendees);
loadWishes();
loadAttendees();

if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
  document.documentElement.classList.add("js-ready");
}
