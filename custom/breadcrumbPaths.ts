import { FullSlug, SimpleSlug, resolveRelative, simplifySlug } from "../quartz/util/path"
import { languageFromLocale, languageFromSlug, TagLanguage } from "./tagPaths"

type BreadcrumbFile = {
  slug?: string
  frontmatter?: Record<string, unknown>
}

export type LocalizedCrumb = {
  displayName: string
  path: string
}

export type BreadcrumbNames = Record<
  TagLanguage,
  {
    root: string
    language: string
  }
>

export const DEFAULT_BREADCRUMB_NAMES: BreadcrumbNames = {
  en: { root: "Home", language: "English" },
  es: { root: "Inicio", language: "Español" },
}

function pageTitle(file?: BreadcrumbFile): string | undefined {
  const title = file?.frontmatter?.title
  return typeof title === "string" ? title : undefined
}

export function getLocalizedBreadcrumbs(
  currentSlug: string,
  allFiles: BreadcrumbFile[],
  configuredLocale: string,
  names: BreadcrumbNames = DEFAULT_BREADCRUMB_NAMES,
  showCurrentPage = true,
): LocalizedCrumb[] {
  const fullSlug = currentSlug as FullSlug
  const language = languageFromSlug(currentSlug) ?? languageFromLocale(configuredLocale) ?? "es"
  const segments = currentSlug.split("/").filter(Boolean)
  const crumbs: LocalizedCrumb[] = [
    {
      displayName: names[language].root,
      path: resolveRelative(fullSlug, "/" as SimpleSlug),
    },
  ]

  segments.forEach((segment, index) => {
    const prefix = segments.slice(0, index + 1).join("/")
    const folderSlug = `${prefix}/index`
    const matchingFile = allFiles.find((file) => file.slug === prefix || file.slug === folderSlug)
    const isLanguageSegment = index === 0 && segment === language
    const displayName = isLanguageSegment
      ? names[language].language
      : (pageTitle(matchingFile) ?? segment.replaceAll("-", " "))
    const isCurrentPage = index === segments.length - 1
    const target = simplifySlug((matchingFile?.slug ?? folderSlug) as FullSlug)

    crumbs.push({
      displayName,
      path: isCurrentPage ? "" : resolveRelative(fullSlug, target),
    })
  })

  if (!showCurrentPage) crumbs.pop()
  return crumbs
}
