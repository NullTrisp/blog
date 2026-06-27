import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const LanguageSwitcher: QuartzComponent = ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
  const currentSlug = fileData.slug
  if (!currentSlug) return null

  // Determine current language
  let currentLang = "en"
  if (currentSlug.startsWith("es/")) currentLang = "es"
  else if (currentSlug.startsWith("en/")) currentLang = "en"
  else return null // Hide if not in a language subfolder

  const targetLang = currentLang === "es" ? "en" : "es"
  const transId = fileData.frontmatter?.translation_id

  // Default target is the root of the other language
  let targetSlug = `/${targetLang}/`

  // If we have a translation ID, search all files for the matching one in the target language
  if (transId) {
    const match = allFiles.find(
      (f) =>
        f.frontmatter?.translation_id === transId &&
        f.slug?.startsWith(`${targetLang}/`)
    )
    if (match && match.slug) {
      targetSlug = `/${match.slug}`
    }
  }

  const label = targetLang === "es" ? "ES" : "EN"

  return (
    <div class={classNames(displayClass, "language-switcher")}>
      <span class="lang-label">{currentLang.toUpperCase()}</span>
      <span>|</span>
      <a href={targetSlug} class="lang-link">{label}</a>
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
