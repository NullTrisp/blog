import { GlobalConfiguration } from "../quartz/cfg"
import { QuartzComponent, QuartzComponentProps } from "../quartz/components/types"
import { TRANSLATIONS, ValidLocale } from "../quartz/i18n"
import { QuartzTransformerPlugin } from "../quartz/plugins/types"

type LocalizedPage = {
  slug?: string
  frontmatter?: {
    lang?: unknown
  }
}

export const PAGE_LOCALES = {
  en: "en-US",
  es: "es-ES",
} as const satisfies Record<string, ValidLocale>

const validLocales = Object.keys(TRANSLATIONS) as ValidLocale[]

function localeFromLanguage(
  languageOrLocale: unknown,
  configuredLocale: ValidLocale,
): ValidLocale | undefined {
  if (typeof languageOrLocale !== "string") return undefined

  const normalized = languageOrLocale.trim().replace("_", "-").toLowerCase()
  if (normalized.length === 0) return undefined

  const exactLocale = validLocales.find((locale) => locale.toLowerCase() === normalized)
  if (exactLocale) return exactLocale

  const language = normalized.split("-")[0]
  if (configuredLocale.toLowerCase().split("-")[0] === language) return configuredLocale

  return PAGE_LOCALES[language as keyof typeof PAGE_LOCALES]
}

/** Resolve a page's UI locale from frontmatter, then its first URL segment. */
export function getPageLocale(configuredLocale: ValidLocale, page: LocalizedPage): ValidLocale {
  const frontmatterLocale = localeFromLanguage(page.frontmatter?.lang, configuredLocale)
  if (frontmatterLocale) return frontmatterLocale

  const slugLanguage = page.slug?.split("/").find(Boolean)
  return localeFromLanguage(slugLanguage, configuredLocale) ?? configuredLocale
}

/** Add an HTML language to localized pages without editing every Markdown file. */
export const PageLanguage: QuartzTransformerPlugin = () => ({
  name: "PageLanguage",
  markdownPlugins(ctx) {
    return [
      () => {
        return (_tree, file) => {
          if (!file.data.frontmatter || file.data.frontmatter.lang) return

          const locale = getPageLocale(ctx.cfg.configuration.locale, file.data)
          file.data.frontmatter.lang = locale.split("-")[0]
        }
      },
    ]
  },
})

/** Pass a page-specific locale to an existing Quartz component. */
export function withPageLocale(Component: QuartzComponent): QuartzComponent {
  const LocalizedComponent: QuartzComponent = (props: QuartzComponentProps) => {
    const locale = getPageLocale(props.cfg.locale, props.fileData)
    const cfg: GlobalConfiguration =
      locale === props.cfg.locale ? props.cfg : { ...props.cfg, locale }

    return <Component {...props} cfg={cfg} />
  }

  LocalizedComponent.displayName = Component.displayName
  LocalizedComponent.afterDOMLoaded = Component.afterDOMLoaded
  LocalizedComponent.beforeDOMLoaded = Component.beforeDOMLoaded
  LocalizedComponent.css = Component.css
  return LocalizedComponent
}
