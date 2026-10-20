// File: components/admin/table-qr-card.tsx
"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

export function TableQrCard({
  tableNumber,
  label,
  outletSlug,
}: {
  tableNumber: string;
  label?: string | null;
  /** Slug outlet meja ini — QR mengarah ke menu outlet tersebut. */
  outletSlug: string;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(
      `${window.location.origin}/${outletSlug}/menu?table=${encodeURIComponent(tableNumber)}`
    );
  }, [tableNumber, outletSlug]);

  function handlePrint() {
    window.print();
  }

  if (!url) return null;

  return (
    <div>
      <div
        id="printable-qr"
        className="flex flex-col items-center gap-3 py-4 bg-white text-black rounded-lg"
      >
        <QRCodeSVG value={url} size={200} />
        <div className="text-center">
          <p className="font-serif text-xl font-bold">Meja {tableNumber}</p>
          {label && <p className="text-sm text-gray-500">{label}</p>}
          {/* Nama outlet tampil di bawah QR — supaya kertas QR tiap outlet mudah dibedakan */}
          <p className="text-xs text-gray-500">/&#8203;{outletSlug}/menu</p>
        </div>
      </div>
      <Button onClick={handlePrint} className="w-full mt-3">
        Print QR
      </Button>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-qr, #printable-qr * {
            visibility: visible;
          }
          #printable-qr {
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </div>
  );
}