export type OtpResult =
  | { type: 'code'; value: string }
  | { type: 'link'; value: string };

export function extractOtp(messageBody: string): OtpResult | null {
  if (!messageBody) return null;

  // Pattern 1: OTP link — shortlink atau URL verifikasi
  // Contoh: "id.shp.ee/dlink/we42bd0", "https://shopee.co.id/verify/xxx"
  const linkPattern =
    /https?:\/\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s]+/gi;
  const linkMatches = messageBody.match(linkPattern);
  if (linkMatches) {
    return { type: 'link', value: linkMatches[0] };
  }

  // Normalisasi: hapus pemisah seperti dash atau spasi di tengah angka
  // "123-456" → "123456", "123 456" → "123456"
  const normalized = messageBody.replace(/(\d)[-\s](\d)/g, '$1$2');

  // Pattern 2: keyword + digit
  const keywordPattern =
    /(?:otp|kode|code|verifikasi|verification|pin|password)[^\d]{0,20}(\d{4,8})/i;
  const keywordMatch = normalized.match(keywordPattern);
  if (keywordMatch) return { type: 'code', value: keywordMatch[1] };

  // Pattern 3: standalone 4-8 digit (fallback)
  const standalonePattern = /\b(\d{4,8})\b/;
  const standaloneMatch = normalized.match(standalonePattern);
  if (standaloneMatch) return { type: 'code', value: standaloneMatch[1] };

  return null;
}
