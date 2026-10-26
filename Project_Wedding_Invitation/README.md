# My Demon Wedding — Scrapbook RSVP

Undangan fan-made Do Do-hee & Jung Gu-won dari drama *My Demon*. Desain mempertahankan konsep scrapbook/editorial project awal: cover majalah, polaroid, kalender, surat, timeline, playlist, tiket acara, galeri foto, RSVP, dan buku ucapan. Palet warna diubah ke navy dan cream.

## Menjalankan

1. Install Node.js 20 atau lebih baru.
2. Extract ZIP dan buka folder `My-Demon-Wedding` di VS Code.
3. Buka terminal pada folder itu, lalu jalankan `npm start`. Tidak perlu `npm install` karena server memakai modul bawaan Node.js.
4. Buka `http://localhost:3000` di browser.

Jangan jalankan memakai Live Server saja. RSVP perlu backend Node agar server dapat menulis data ke file database. Bootstrap diload dengan CDN link dari jsDelivr.

## Database RSVP

Setiap jawaban masuk ke `database/rsvps.json`. Data berisi nama, status kehadiran, jumlah tamu, ucapan, pilihan publik, dan waktu pengiriman. Data tetap ada setelah browser ditutup atau server dimulai ulang. Daftar pada halaman mengambil data dari endpoint `/api/attendees`; buku ucapan hanya menampilkan ucapan yang disetujui tamu. Nama dan status hadir tampil pada daftar jika checkbox publik daftar tamu dicentang (default aktif).

Untuk melihat semua data termasuk RSVP yang tidak dipublikasikan, buka `database/rsvps.json` melalui VS Code. File ini berada di luar `public`, jadi tidak bisa diunduh langsung melalui alamat website. Buat salinan/backup file ini secara berkala. File JSON cocok untuk tugas atau penggunaan kecil di satu server; jika dipakai secara ramai di beberapa server, beralihlah ke database sungguhan.

## Foto

Galeri memakai empat still promosi berbeda dari *My Demon* yang disediakan lewat tautan gambar Soompi. Gambar tidak digenerate AI dan tidak diunduh/disalin ke ZIP. Browser memerlukan internet untuk memuatnya. Kredit dan direct links ada di `public/assets/ASSETS.md`; hak cipta gambar tetap milik pemegang hak masing-masing.

## Struktur folder

```text
My-Demon-Wedding/
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── style.css
│   │   └── scrapbook.css
│   ├── js/app.js
│   └── assets/
│       ├── ASSETS.md
│       ├── favicon.svg
│       ├── fonts/
│       └── audio/little-forever.wav
├── database/rsvps.json
├── server.js
├── package.json
└── README.md
```

Karakter adalah karakter fiksi. Nama/cerita dan tanggal/venue undangan ini dipakai untuk proyek akademik fan-made.
