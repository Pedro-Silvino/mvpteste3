import type { MetadataRoute } from "next";

// Only the public pages may be indexed. The dashboard, staff area and questionnaire are private.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/painel", "/staff", "/diagnostico", "/conta", "/resultado", "/auth", "/redefinir-senha"],
    },
  };
}
