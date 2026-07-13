import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#1BA8E0" />
          <path
            d="M8 38 C18 24 28 34 32 28 C36 34 46 24 56 38 C46 32 36 38 32 33 C28 38 18 32 8 38 Z"
            fill="#8DB63C"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
