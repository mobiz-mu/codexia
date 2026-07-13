import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg width="32" height="32" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" fill="#1BA8E0" />
        <path
          d="M8 38 C18 24 28 34 32 28 C36 34 46 24 56 38 C46 32 36 38 32 33 C28 38 18 32 8 38 Z"
          fill="#8DB63C"
        />
      </svg>
    ),
    { ...size }
  );
}
