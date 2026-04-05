/** 生图时「若画面含可读新增文字」的书写语言（默认中文）。 */
export const IMAGE_TEXT_LANGUAGE_CODES = [
  "zh",
  "en",
  "fr",
  "de",
  "es",
  "pt",
  "it",
  "ja",
  "ko",
  "ru",
  "ms",
  "fil",
  "th",
  "ar",
] as const;

export type ImageTextLanguage = (typeof IMAGE_TEXT_LANGUAGE_CODES)[number];

export const DEFAULT_IMAGE_TEXT_LANGUAGE: ImageTextLanguage = "zh";

export const IMAGE_TEXT_LANGUAGE_OPTIONS: {
  value: ImageTextLanguage;
  label: string;
}[] = [
  { value: "zh", label: "中文（简体）" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "ru", label: "Русский" },
  { value: "ms", label: "Bahasa Melayu" },
  { value: "fil", label: "Filipino (Tagalog)" },
  { value: "th", label: "ไทย" },
  { value: "ar", label: "العربية" },
];

export function getImageTextLanguageLabel(code: string): string {
  const found = IMAGE_TEXT_LANGUAGE_OPTIONS.find((o) => o.value === code);
  return found?.label ?? code;
}
