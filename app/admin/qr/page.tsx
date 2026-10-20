"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { ADMIN_PAGE } from "@/components/admin/ui";
import { SECONDARY } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";

// Guests can't reach a localhost address, so it is shown in red.
const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);

// Printable QR code for the guest URL (this site's address). Black on white at a large size so
// it scans from across a room; the nav is hidden when printing.
export default function AdminQrPage() {
  const [url, setUrl] = useState<string | null>(null);
  const [png, setPng] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const guestUrl = window.location.origin;
    setUrl(guestUrl);
    QRCode.toDataURL(guestUrl, { width: 1024, margin: 2, errorCorrectionLevel: "M" })
      .then(setPng)
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className={`${ADMIN_PAGE} text-center print:max-w-none print:text-black`}>
      <h1 className="mb-2 font-title text-5xl text-pumpkin print:text-black">Scan to vote for best costume!</h1>
      {png && url ? (
        <img src={png} alt={`QR code for ${url}`} className="mx-auto my-4 w-full max-w-md rounded-2xl bg-white" />
      ) : (
        <p className="my-8 text-lg">{failed ? "Couldn't make the QR code. Reload the page." : "Making the QR code…"}</p>
      )}
      {url && (
        <p className={`mb-4 break-all text-lg ${isLocal(url) ? "font-bold text-red-400 print:text-red-600" : "text-violet-200 print:text-black"}`}>
          {url}
        </p>
      )}
      <ul className="mb-6 space-y-1 text-2xl font-semibold">
        {CATEGORIES.map((c) => (
          <li key={c.slug}>{c.label}</li>
        ))}
      </ul>
      {png && (
        <a href={png} download="costume-voting-qr.png" className={`${SECONDARY} print:hidden`}>
          Download PNG
        </a>
      )}
      <button type="button" onClick={() => window.print()} className={`${SECONDARY} ml-3 print:hidden`}>
        Print
      </button>
    </main>
  );
}
