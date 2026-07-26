import { FullSlug, joinSegments, simplifySlug } from "../quartz/util/path"

export const TAG_LANGUAGES = ["en", "es"] as const
export type TagLanguage = (typeof TAG_LANGUAGES)[number]

export function languageFromSlug(slug?: string): TagLanguage | undefined {
  const language = slug?.split("/").find(Boolean)
  return TAG_LANGUAGES.find((candidate) => candidate === language)
}

export function languageFromLocale(locale: string): TagLanguage | undefined {
  const language = locale.toLowerCase().split("-")[0]
  return TAG_LANGUAGES.find((candidate) => candidate === language)
}

export function getLocalizedTagSlug(
  sourceSlug: string | undefined,
  tag: string,
  configuredLocale: string,
): FullSlug {
  const language = languageFromSlug(sourceSlug) ?? languageFromLocale(configuredLocale) ?? "es"
  return joinSegments(language, "tags", tag) as FullSlug
}

export function parseLocalizedTagSlug(
  slug?: string,
): { language: TagLanguage; tag: string } | undefined {
  if (!slug) return undefined

  const segments = slug.split("/").filter(Boolean)
  const language = languageFromSlug(slug)
  if (!language || segments[1] !== "tags" || segments.length < 3) return undefined

  const tag = simplifySlug(segments.slice(2).join("/") as FullSlug)
  return { language, tag }
}
