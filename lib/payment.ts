/**
 * Batas waktu pembayaran sebelum pesanan otomatis dibatalkan.
 * Berlaku untuk QRIS (halaman /order/[id]/pay).
 *
 * Sengaja di file terpisah: file "use server" hanya boleh mengekspor
 * async function, jadi konstanta tidak bisa ditaruh di sana.
 */
export const PAYMENT_WINDOW_MINUTES = 15;
