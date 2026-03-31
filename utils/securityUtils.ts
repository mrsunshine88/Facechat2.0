/**
 * FACECHAT 2.0 - SECURITY UTILS (FORTNOX STANDARD)
 * Implementerar strikt CSS-sanering och Zero-Trust validering.
 */

/**
 * Sanerar användargenererad CSS för att förhindra exfiltrering och UI-redressing.
 * Tar bort url(), @import och farliga positionerings-attribut.
 */
export function sanitizeCSS(css: string): string {
  if (!css) return "";

  let cleaned = css;

  // 1. Skydd mot HTML-escape (XSS via </style>)
  cleaned = cleaned.replace(/<\/style>/gi, "");
  cleaned = cleaned.replace(/<style/gi, "");
  cleaned = cleaned.replace(/<script/gi, "");
  cleaned = cleaned.replace(/<\/script>/gi, "");

  // 2. Skydd mot CSS-exfiltrering (Inga externa anrop!)
  // Vi tillåter säkra data-uris (för mönster/emojis) men blockerar externa url:er
  cleaned = cleaned.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, url) => {
    if (url.startsWith('data:image/')) {
      return match; // Säkert!
    }
    return "none /* blocked */";
  });
  cleaned = cleaned.replace(/@import\s+[\s\S]*?;/gi, "/* import blocked */");
  cleaned = cleaned.replace(/src\s*:/gi, "disabled-src:");

  // 3. Skydd mot UI-Redressing / Clickjacking
  // Vi förbjuder 'fixed' positionering då det kan användas för att täcka hela sidan.
  cleaned = cleaned.replace(/position\s*:\s*fixed/gi, "position: absolute");
  
  // Vi begränsar extremt stora negativa värden som används för att flytta element utanför skärmen/cover
  cleaned = cleaned.replace(/[-\d]{5,}px/g, "0px"); 

  // 4. Skydd mot legacy IE-hacks (expression och behavior)
  cleaned = cleaned.replace(/expression\s*\([\s\S]*?\)/gi, "none");
  cleaned = cleaned.replace(/behavior\s*:/gi, "disabled-behavior:");

  // 5. Begränsa längden (Panic-stop vid gigantisk input)
  if (cleaned.length > 20000) {
    cleaned = cleaned.substring(0, 15000) + "\n/* Truncated for security */";
  }

  return cleaned;
}
