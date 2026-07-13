import type { CSSProperties, ReactNode } from "react";

// Minimal plain-HTML replacements for @react-email/components. That package's
// latest published version (1.0.12, the newest on npm) still hard-depends on
// a set of @react-email/* primitive packages (row, text, section, ...) that
// their maintainer has marked "no longer supported" — every fresh `npm install`
// prints ~20 deprecation warnings for packages this project can't upgrade out
// of. These templates were already simple (inline styles, no tables/columns),
// so replacing the JSX wrappers with the plain tags they rendered under the
// hood removes the deprecated dependency chain entirely.

export function Html({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      {children}
    </html>
  );
}

export function Head() {
  return (
    // This is an email document's <head>, not a Next.js page — the
    // next/head lint rule doesn't apply here.
    // eslint-disable-next-line @next/next/no-head-element
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </head>
  );
}

// Renders a snippet only visible in the inbox preview line, matching
// @react-email/components' Preview behavior (hidden in the actual body).
export function Preview({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "none",
        overflow: "hidden",
        lineHeight: 1,
        opacity: 0,
        maxHeight: 0,
        maxWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

export function Body({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return <body style={style}>{children}</body>;
}

export function Container({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return <div style={{ maxWidth: "600px", margin: "0 auto", ...style }}>{children}</div>;
}

export function Heading({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return <h1 style={{ margin: "0 0 16px", ...style }}>{children}</h1>;
}

export function Text({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return <p style={{ fontSize: "14px", lineHeight: "24px", margin: "16px 0", ...style }}>{children}</p>;
}

export function Section({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return <div style={style}>{children}</div>;
}

export function Hr({ style }: { style?: CSSProperties } = {}) {
  return <hr style={{ borderColor: "#E5E7EB", margin: "20px 0", ...style }} />;
}
