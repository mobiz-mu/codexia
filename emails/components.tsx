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

export function Img({
  src,
  alt,
  width,
  height,
  style,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={width} height={height} style={{ border: "0", ...style }} />;
}

const FOOTER_COPY = {
  en: { contact: "Questions? Contact us:", whatsapp: "WhatsApp", website: "Website", maps: "Find Us", follow: "Follow us:" },
  fr: { contact: "Des questions ? Contactez-nous :", whatsapp: "WhatsApp", website: "Site web", maps: "Nous trouver", follow: "Suivez-nous :" },
} as const;

/**
 * The one footer every customer-facing email shares — support contact,
 * WhatsApp, website, an optional Google Maps link, and social links.
 * Standardizing this in one place (instead of each template re-building its
 * own sign-off block) is what actually keeps "every email looks the same"
 * true over time.
 */
export function EmailFooter({
  locale,
  supportEmail,
  whatsappUrl,
  siteUrl,
  mapsUrl,
  socials,
}: {
  locale: "en" | "fr";
  supportEmail: string;
  whatsappUrl: string;
  siteUrl: string;
  mapsUrl?: string;
  socials?: { facebook?: string; instagram?: string };
}) {
  const t = FOOTER_COPY[locale];
  const hasSocials = Boolean(socials?.facebook || socials?.instagram);

  return (
    <>
      <Hr />
      <Text style={{ color: "#6B7280", fontSize: "14px" }}>
        {t.contact}{" "}
        <a href={`mailto:${supportEmail}`} style={{ color: "#1BA8E0" }}>
          {supportEmail}
        </a>
      </Text>
      <Text style={{ color: "#6B7280", fontSize: "13px" }}>
        <a href={whatsappUrl} style={{ color: "#1BA8E0" }}>
          {t.whatsapp}
        </a>
        {" · "}
        <a href={siteUrl} style={{ color: "#1BA8E0" }}>
          {t.website}: {siteUrl.replace(/^https?:\/\//, "")}
        </a>
        {mapsUrl && (
          <>
            {" · "}
            <a href={mapsUrl} style={{ color: "#1BA8E0" }}>
              {t.maps}
            </a>
          </>
        )}
      </Text>
      {hasSocials && (
        <Text style={{ color: "#6B7280", fontSize: "13px" }}>
          {t.follow}{" "}
          {socials?.facebook && (
            <a href={socials.facebook} style={{ color: "#1BA8E0" }}>
              Facebook
            </a>
          )}
          {socials?.facebook && socials?.instagram && " · "}
          {socials?.instagram && (
            <a href={socials.instagram} style={{ color: "#1BA8E0" }}>
              Instagram
            </a>
          )}
        </Text>
      )}
    </>
  );
}

export function EmailHeader({ logoUrl }: { logoUrl: string }) {
  return <Img src={logoUrl} alt="Codexia Ltd" width={140} height={140} style={{ marginBottom: "16px" }} />;
}

export function Button({
  href,
  style,
  children,
}: {
  href: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        borderRadius: "999px",
        backgroundColor: "#1BA8E0",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: 600,
        textDecoration: "none",
        padding: "10px 20px",
        ...style,
      }}
    >
      {children}
    </a>
  );
}
