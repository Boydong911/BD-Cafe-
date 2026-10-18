"use client";

/*
 * Penanda "pesanan ini dibuat dari board kasir".
 *
 * Kenapa perlu dan kenapa session staff tidak cukup:
 *
 * Di perangkat bersama (tablet di counter), kasir tetap login sambil
 * pelanggan membuat pesanan lewat /menu?table=02. Kalau penentunya
 * "apakah ada sesi staff?", pelanggan itu ikut terhitung sebagai kasir --
 * lalu melihat tombol "Cetak Struk" dan "Kembali ke Kasir", dan misled
 * berakhir di board staff. Itu yang terjadi dan ini sebabnya penanda
 * terpisah.
 *
 * sessionStorage, bukan localStorage: penanda ini hanya berlaku di tab
 * tempat alur kasir berjalan. Kalau kena localStorage, sesi meja milik
 * pelanggan di HP-nya bisa terbaca di perangkat kasir saat keduanya memakai
 * perangkat yang sama.
 *
 * ⚠️ Penanda ini untuk TAMPILAN saja. Semua aksi sungguhan (selesaikan,
 * batalkan, catat pembayaran) tetap dicek ulang di server lewat
 * assertStaff(), jadi mengarang flag ini tidak memberi akses apa pun.
 *
 * ⚠️ RISIKO SISA: kalau kasir membuka board kasir lalu BERHENTI di tengah
 * tanpa memesan, lalu membuka menu sebagai pelanggan di tab yang sama,
 * penandanya masih menyala. Jalur itu jarang dan tidak membuka akses baru.
 * Kalau nanti bothered, pindahkan penandanya ke kolom di tabel orders.
 */

const KEY = "bd-coffee-order-source";

export function markFromKasir(): void {
  try {
    sessionStorage.setItem(KEY, "kasir");
  } catch {
    // Mode privat / storage diblokir: alur kasir tetap jalan, hanya
    // tombol khususnya yang tidak muncul. Bukan error fatal.
  }
}

export function clearOrderSource(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Lihat catatan di markFromKasir.
  }
}

export function isFromKasir(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "kasir";
  } catch {
    return false;
  }
}
