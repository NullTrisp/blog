import { ComponentChildren, VNode, cloneElement, isValidElement, toChildArray } from "preact"
import { i18n } from "../quartz/i18n"
import { CustomOgImagesEmitterName } from "../quartz/plugins/emitters/ogImage"
import { QuartzPluginData } from "../quartz/plugins/vfile"
import {
  FullSlug,
  getFileExtension,
  isAbsoluteURL,
  joinSegments,
  pathToRoot,
  simplifySlug,
  stripSlashes,
} from "../quartz/util/path"
import { CSSResourceToStyleElement, JSResourceToScriptElement } from "../quartz/util/resources"
import { googleFontHref, googleFontSubsetHref } from "../quartz/util/theme"
import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "../quartz/components/types"
import { unescapeHTML } from "../quartz/util/escape"
import { getLocalizedBreadcrumbs } from "./breadcrumbPaths"
import { getPageLocale } from "./localization"
import { languageFromLocale, languageFromSlug, TAG_LANGUAGES, TagLanguage } from "./tagPaths"

interface SeoHeadOptions {
  /** Defaults to the site's configured page title. */
  authorName?: string
  /** Absolute URL or a path relative to the configured base URL. Defaults to the site root. */
  authorUrl?: string
}

type LanguageAlternate = {
  language: TagLanguage
  url: string
}

const managedSocialMeta = new Set([
  "og:image",
  "og:image:url",
  "og:image:secure_url",
  "og:image:type",
  "og:image:alt",
  "twitter:image",
  "twitter:image:alt",
])

function siteBaseUrl(baseUrl: string | undefined): URL | undefined {
  const rawBaseUrl = baseUrl?.trim()
  if (!rawBaseUrl) return undefined

  try {
    const url = new URL(rawBaseUrl.includes("://") ? rawBaseUrl : `https://${rawBaseUrl}`)
    url.search = ""
    url.hash = ""
    if (!url.pathname.endsWith("/")) url.pathname += "/"
    return url
  } catch {
    return undefined
  }
}

/** Return the public, extensionless URL Quartz emits for a slug. */
export function cleanPageUrl(baseUrl: string | undefined, slug: string | undefined) {
  const base = siteBaseUrl(baseUrl)
  if (!base || !slug) return undefined

  const simpleSlug = simplifySlug(slug as FullSlug)
  const relativePath = simpleSlug === "/" ? "" : stripSlashes(simpleSlug, true)
  return new URL(relativePath, base).toString()
}

function absoluteSiteUrl(base: URL, pathOrUrl: string): string {
  if (isAbsoluteURL(pathOrUrl)) return pathOrUrl
  return new URL(stripSlashes(pathOrUrl, true), base).toString()
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function translationId(file: QuartzPluginData): string | undefined {
  return nonEmptyString(file.frontmatter?.translation_id)
}

function shouldNoIndex(fileData: QuartzPluginData, slug: string): boolean {
  const explicit = fileData.frontmatter?.noindex
  if (explicit === true || explicit === "true") return true

  return /^(en|es)\/tags(?:\/|$)/.test(slug)
}

function isProfilePage(fileData: QuartzPluginData): boolean {
  return translationId(fileData) === "about"
}

function isArticlePage(fileData: QuartzPluginData, slug: string): boolean {
  return (
    fileData.filePath !== undefined &&
    simplifySlug(slug as FullSlug) !== "/" &&
    !slug.endsWith("/index") &&
    !isProfilePage(fileData)
  )
}

/** Find a complete, reciprocal English/Spanish translation set for the current page. */
export function getLanguageAlternates(
  baseUrl: string | undefined,
  fileData: QuartzPluginData,
  allFiles: QuartzPluginData[],
): LanguageAlternate[] {
  const isRoot = fileData.slug ? simplifySlug(fileData.slug) === "/" : false
  const id = isRoot ? "home" : translationId(fileData)
  const currentLanguage = languageFromSlug(fileData.slug)
  if (!id || (!isRoot && !currentLanguage)) return []

  const matches = new Map<TagLanguage, QuartzPluginData>()
  for (const file of allFiles) {
    if (translationId(file) !== id) continue

    const language = languageFromSlug(file.slug)
    if (language && !matches.has(language)) matches.set(language, file)
  }

  // An incomplete set cannot be reciprocal, so do not advertise it as one.
  if (!TAG_LANGUAGES.every((language) => matches.has(language))) return []

  return TAG_LANGUAGES.flatMap((language) => {
    const url = cleanPageUrl(baseUrl, matches.get(language)?.slug)
    return url ? [{ language, url }] : []
  })
}

function imageMimeType(imageUrl: string): string {
  let path = imageUrl
  try {
    path = new URL(imageUrl, "https://example.com").pathname
  } catch {
    // The extension helper below will fall back to PNG for malformed paths.
  }

  const extension = getFileExtension(path)?.slice(1).toLowerCase()
  const mimeSubtype = extension === "jpg" ? "jpeg" : extension === "svg" ? "svg+xml" : extension
  return `image/${mimeSubtype ?? "png"}`
}

function socialImageUrl(
  base: URL | undefined,
  fileData: QuartzPluginData,
  usesCustomOgImage: boolean,
  iconBaseDir: string,
): string {
  const customImage = nonEmptyString(fileData.frontmatter?.socialImage)
  if (customImage) {
    if (isAbsoluteURL(customImage)) return customImage
    if (base) return absoluteSiteUrl(base, joinSegments("static", customImage))
    return joinSegments(iconBaseDir, "static", customImage)
  }

  if (base && usesCustomOgImage && fileData.filePath && fileData.slug) {
    return absoluteSiteUrl(base, `${fileData.slug}-og-image.webp`)
  }

  return base
    ? absoluteSiteUrl(base, "static/og-image.png")
    : joinSegments(iconBaseDir, "static/og-image.png")
}

function isManagedSocialMeta(node: VNode): boolean {
  if (node.type !== "meta") return false
  const props = node.props as Record<string, unknown>
  const key = props.property ?? props.name
  return typeof key === "string" && managedSocialMeta.has(key.toLowerCase())
}

/** Keep plugin-provided head resources while avoiding duplicate social image metadata. */
function withoutManagedSocialMeta(children: ComponentChildren): ComponentChildren {
  return toChildArray(children).map((child) => {
    if (!isValidElement(child)) return child
    if (isManagedSocialMeta(child)) return null

    const props = child.props as { children?: ComponentChildren }
    if (props.children === undefined) return child

    return cloneElement(child, {}, withoutManagedSocialMeta(props.children))
  })
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029")
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return undefined
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function articleDates(fileData: QuartzPluginData) {
  const frontmatter = fileData.frontmatter

  return {
    datePublished: isoDate(
      frontmatter?.published ??
        frontmatter?.publishDate ??
        frontmatter?.date ??
        fileData.dates?.published ??
        fileData.dates?.created,
    ),
    dateModified: isoDate(
      fileData.dates?.modified ??
        frontmatter?.modified ??
        frontmatter?.lastmod ??
        frontmatter?.updated ??
        frontmatter?.["last-modified"],
    ),
  }
}

function stringList(value: unknown): string[] | undefined {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : []
  const strings = values.flatMap((item) => {
    const value = nonEmptyString(item)
    return value ? [value] : []
  })
  return strings.length > 0 ? strings : undefined
}

function breadcrumbSchema(
  canonicalUrl: string,
  fileData: QuartzPluginData,
  allFiles: QuartzPluginData[],
  configuredLocale: string,
) {
  if (!fileData.slug || simplifySlug(fileData.slug) === "/") return undefined

  const crumbs = getLocalizedBreadcrumbs(fileData.slug, allFiles, configuredLocale)
  if (crumbs.length < 2) return undefined

  const items = crumbs.reduce<{ name: string; item: string }[]>((result, crumb) => {
    const item = crumb.path ? new URL(crumb.path, canonicalUrl).toString() : canonicalUrl
    const previous = result.at(-1)
    if (previous?.item === item) {
      previous.name = crumb.displayName
    } else {
      result.push({ name: crumb.displayName, item })
    }
    return result
  }, [])

  return {
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      ...item,
    })),
  }
}

function localizedAuthorUrl(
  baseUrl: string | undefined,
  allFiles: QuartzPluginData[],
  locale: string,
): string | undefined {
  const language = languageFromLocale(locale)
  const authorPage = allFiles.find(
    (file) => translationId(file) === "about" && languageFromSlug(file.slug) === language,
  )
  return cleanPageUrl(baseUrl, authorPage?.slug)
}

function structuredData({
  cfg,
  fileData,
  allFiles,
  canonicalUrl,
  description,
  imageUrl,
  locale,
  options,
}: {
  cfg: QuartzComponentProps["cfg"]
  fileData: QuartzPluginData
  allFiles: QuartzPluginData[]
  canonicalUrl: string | undefined
  description: string
  imageUrl: string
  locale: string
  options: SeoHeadOptions
}): unknown | undefined {
  const slug = fileData.slug
  const base = siteBaseUrl(cfg.baseUrl)
  if (!slug || !base || !canonicalUrl || slug === "404") return undefined

  const rootUrl = cleanPageUrl(cfg.baseUrl, "index")!
  const websiteId = `${rootUrl}#website`
  const authorName =
    nonEmptyString(fileData.frontmatter?.author) ?? options.authorName ?? cfg.pageTitle
  const authorUrl = options.authorUrl
    ? absoluteSiteUrl(base, options.authorUrl)
    : (localizedAuthorUrl(cfg.baseUrl, allFiles, locale) ?? rootUrl)
  const authorId = `${rootUrl}#person`
  const isRoot = simplifySlug(slug) === "/"

  if (isRoot) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": websiteId,
          url: rootUrl,
          name: cfg.pageTitle,
          description,
          inLanguage: locale,
          publisher: { "@id": authorId },
        },
        {
          "@type": "Person",
          "@id": authorId,
          name: authorName,
          url: authorUrl,
        },
      ],
    }
  }

  const graph: Record<string, unknown>[] = []
  const profilePage = isProfilePage(fileData)
  if (profilePage) {
    graph.push(
      {
        "@type": "ProfilePage",
        "@id": `${canonicalUrl}#profile`,
        url: canonicalUrl,
        name: fileData.frontmatter?.title,
        description,
        inLanguage: locale,
        mainEntity: { "@id": authorId },
        isPartOf: { "@id": websiteId },
      },
      {
        "@type": "Person",
        "@id": authorId,
        name: authorName,
        url: authorUrl,
        mainEntityOfPage: { "@id": `${canonicalUrl}#profile` },
      },
    )
  }

  const isArticle = isArticlePage(fileData, slug)
  if (isArticle) {
    const { datePublished, dateModified } = articleDates(fileData)
    const keywords = stringList(fileData.frontmatter?.tags)
    graph.push({
      "@type": "BlogPosting",
      "@id": `${canonicalUrl}#article`,
      url: canonicalUrl,
      mainEntityOfPage: canonicalUrl,
      headline: fileData.frontmatter?.title,
      description,
      image: imageUrl,
      inLanguage: locale,
      author: {
        "@type": "Person",
        "@id": authorId,
        name: authorName,
        url: authorUrl,
      },
      publisher: { "@id": authorId },
      isPartOf: { "@id": websiteId },
      ...(datePublished ? { datePublished } : {}),
      ...(dateModified ? { dateModified } : {}),
      ...(keywords ? { keywords } : {}),
    })
  }

  const breadcrumbs = breadcrumbSchema(canonicalUrl, fileData, allFiles, cfg.locale)
  if (breadcrumbs) graph.push(breadcrumbs)
  if (graph.length === 0) return undefined

  return { "@context": "https://schema.org", "@graph": graph }
}

export default ((userOptions?: SeoHeadOptions) => {
  const options: SeoHeadOptions = { ...userOptions }

  const SeoHead: QuartzComponent = ({
    cfg,
    fileData,
    externalResources,
    ctx,
    allFiles,
  }: QuartzComponentProps) => {
    const locale = getPageLocale(cfg.locale, fileData)
    const titleSuffix = cfg.pageTitleSuffix ?? ""
    const title = (fileData.frontmatter?.title ?? i18n(locale).propertyDefaults.title) + titleSuffix
    const description =
      fileData.frontmatter?.socialDescription ??
      fileData.frontmatter?.description ??
      unescapeHTML(fileData.description?.trim() ?? i18n(locale).propertyDefaults.description)
    const slug = (fileData.slug ?? "index") as FullSlug
    const base = siteBaseUrl(cfg.baseUrl)
    const iconBaseDir = slug === "404" ? (base?.pathname ?? "/") : pathToRoot(slug)
    const iconPath = joinSegments(iconBaseDir, "static/icon.png")
    const canonicalUrl = slug === "404" ? undefined : cleanPageUrl(cfg.baseUrl, slug)
    const alternates = getLanguageAlternates(cfg.baseUrl, fileData, allFiles)
    const isRoot = simplifySlug(slug) === "/"
    const xDefaultUrl =
      isRoot || translationId(fileData) === "home" ? cleanPageUrl(cfg.baseUrl, "index") : undefined
    const isArticle = isArticlePage(fileData, slug)
    const noIndex = slug === "404" || shouldNoIndex(fileData, slug)
    const pageLanguage = languageFromLocale(locale)
    const ogLocaleAlternates = alternates.filter(({ language }) => language !== pageLanguage)
    const { datePublished, dateModified } = articleDates(fileData)
    const usesCustomOgImage = ctx.cfg.plugins.emitters.some(
      (emitter) => emitter.name === CustomOgImagesEmitterName,
    )
    const imageUrl = socialImageUrl(base, fileData, usesCustomOgImage, iconBaseDir)
    const schema = structuredData({
      cfg,
      fileData,
      allFiles,
      canonicalUrl,
      description,
      imageUrl,
      locale,
      options,
    })
    const { css, js, additionalHead } = externalResources

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        {cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" />
            <link rel="stylesheet" href={googleFontHref(cfg.theme)} />
            {cfg.theme.typography.title && (
              <link rel="stylesheet" href={googleFontSubsetHref(cfg.theme, cfg.pageTitle)} />
            )}
          </>
        )}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
        {alternates.map(({ language, url }) => (
          <link rel="alternate" hrefLang={language} href={url} />
        ))}
        {xDefaultUrl && <link rel="alternate" hrefLang="x-default" href={xDefaultUrl} />}

        <meta property="og:site_name" content={cfg.pageTitle} />
        <meta property="og:title" content={title} />
        <meta property="og:type" content={isArticle ? "article" : "website"} />
        <meta property="og:locale" content={locale.replace("-", "_")} />
        {ogLocaleAlternates.map(({ language }) => (
          <meta property="og:locale:alternate" content={language === "en" ? "en_US" : "es_ES"} />
        ))}
        {isArticle && datePublished && (
          <meta property="article:published_time" content={datePublished} />
        )}
        {isArticle && dateModified && (
          <meta property="article:modified_time" content={dateModified} />
        )}
        <meta property="og:description" content={description} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:url" content={imageUrl} />
        <meta property="og:image:type" content={imageMimeType(imageUrl)} />
        <meta property="og:image:alt" content={description} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
        <meta name="twitter:image:alt" content={description} />
        {cfg.baseUrl && <meta name="twitter:domain" content={siteBaseUrl(cfg.baseUrl)?.host} />}
        {canonicalUrl && (
          <>
            <meta property="og:url" content={canonicalUrl} />
            <meta name="twitter:url" content={canonicalUrl} />
          </>
        )}

        <link rel="icon" href={iconPath} />
        <meta name="description" content={description} />
        {noIndex && <meta name="robots" content="noindex,follow" />}
        <meta name="generator" content="Quartz" />

        {schema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
          />
        )}

        {css.map((resource) => CSSResourceToStyleElement(resource, true))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((resource) => JSResourceToScriptElement(resource, true))}
        {additionalHead.map((resource) => {
          const element = typeof resource === "function" ? resource(fileData) : resource
          return withoutManagedSocialMeta(element)
        })}
      </head>
    )
  }

  return SeoHead
}) satisfies QuartzComponentConstructor<SeoHeadOptions | undefined>
