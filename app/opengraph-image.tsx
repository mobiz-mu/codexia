import { ImageResponse } from "next/og";
import { SITE_DEFAULTS } from "@/lib/config/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          gap: 32,
        }}
      >
        <svg width="140" height="140" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#1BA8E0" />
          <path
            d="M8 38 C18 24 28 34 32 28 C36 34 46 24 56 38 C46 32 36 38 32 33 C28 38 18 32 8 38 Z"
            fill="#8DB63C"
          />
        </svg>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#1F2937" }}>
          {SITE_DEFAULTS.companyName}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#6B7280" }}>
          Mauritius Car Rental — Unlimited Mileage, Full Insurance, 24/7 Support
        </div>
      </div>
    ),
    { ...size }
  );
}
