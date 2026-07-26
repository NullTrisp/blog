import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { FullSlug, simplifySlug } from "../util/path"

type SupportedLanguage = "en" | "es"

type LocalizedFile = {
  slug?: string
  frontmatter?: Record<string, unknown>
}

type LanguageSwitchTarget = {
  currentLang: SupportedLanguage
  targetLang: SupportedLanguage
  targetSlug: string
}

export function getLanguageSwitchTarget(
  currentSlug: string,
  allFiles: LocalizedFile[],
  transId?: unknown,
): LanguageSwitchTarget | undefined {
  const currentLang = currentSlug.startsWith("es/")
    ? "es"
    : currentSlug.startsWith("en/")
      ? "en"
      : undefined

  if (!currentLang) return undefined

  const targetLang = currentLang === "es" ? "en" : "es"
  let match: LocalizedFile | undefined

  if (transId) {
    match = allFiles.find(
      (file) =>
        file.frontmatter?.translation_id === transId && file.slug?.startsWith(`${targetLang}/`),
    )
  }

  // Folder indexes and pages with the same slug often do not need a translation ID.
  // Preserve the path when its equivalent exists in the other language.
  if (!match) {
    const equivalentSlug = `${targetLang}/${currentSlug.split("/").slice(1).join("/")}`
    match = allFiles.find((file) => file.slug === equivalentSlug)
  }

  const targetSlug = match?.slug ? `/${simplifySlug(match.slug as FullSlug)}` : `/${targetLang}/`

  return { currentLang, targetLang, targetSlug }
}

const LanguageSwitcher: QuartzComponent = ({
  fileData,
  allFiles,
  displayClass,
}: QuartzComponentProps) => {
  const currentSlug = fileData.slug
  if (!currentSlug) return null

  const target = getLanguageSwitchTarget(
    currentSlug,
    allFiles,
    fileData.frontmatter?.translation_id,
  )
  if (!target) return null

  const { currentLang, targetLang, targetSlug } = target

  const label = targetLang === "es" ? "ES" : "EN"

  return (
    <div class={classNames(displayClass, "language-switcher")}>
      <span class="lang-label">{currentLang.toUpperCase()}</span>
      <span>|</span>
      <a href={targetSlug} class="lang-link">
        {label}
      </a>
    </div>
  )
}

LanguageSwitcher.css = `
.language-switcher {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-family: var(--headerFont);
  font-weight: 600;
  font-size: 0.9rem;
}

.language-switcher a, .language-switcher .lang-label {
  text-decoration: none;
  color: var(--gray);
  transition: color 0.2s ease;
}

.language-switcher a:hover {
  color: var(--secondary);
}

.language-switcher .lang-label {
  color: var(--secondary);
  pointer-events: none;
}
`

export default (() => LanguageSwitcher) satisfies QuartzComponentConstructor
