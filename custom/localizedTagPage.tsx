import { FullPageLayout } from "../quartz/cfg"
import BodyConstructor from "../quartz/components/Body"
import HeaderConstructor from "../quartz/components/Header"
import { pageResources, renderPage } from "../quartz/components/renderPage"
import { QuartzComponentProps } from "../quartz/components/types"
import { i18n } from "../quartz/i18n"
import { QuartzEmitterPlugin } from "../quartz/plugins/types"
import {
  defaultProcessedContent,
  ProcessedContent,
  QuartzPluginData,
} from "../quartz/plugins/vfile"
import { write } from "../quartz/plugins/emitters/helpers"
import { FullSlug, getAllSegmentPrefixes, joinSegments, pathToRoot } from "../quartz/util/path"
import { defaultListPageLayout, sharedPageComponents } from "../quartz.layout"
import { LocalizedTagContent, localizedConfiguration } from "./tagLocalization"
import { languageFromLocale, languageFromSlug, TAG_LANGUAGES, TagLanguage } from "./tagPaths"

interface LocalizedTagPageOptions extends FullPageLayout {
  sort?: (f1: QuartzPluginData, f2: QuartzPluginData) => number
}

type GeneratedTagPage = {
  language: TagLanguage
  tag: string
  content: ProcessedContent
}

function createTagPages(allFiles: QuartzPluginData[]): GeneratedTagPage[] {
  return TAG_LANGUAGES.flatMap((language) => {
    const languageFiles = allFiles.filter((file) => languageFromSlug(file.slug) === language)
    const tags = new Set(
      languageFiles.flatMap((data) => data.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes),
    )
    tags.add("index")

    return [...tags].map((tag) => {
      const cfgLocale = language === "en" ? "en-US" : "es-ES"
      const title =
        tag === "index"
          ? i18n(cfgLocale).pages.tagContent.tagIndex
          : `${i18n(cfgLocale).pages.tagContent.tag}: ${tag}`
      const slug = joinSegments(language, "tags", tag) as FullSlug

      return {
        language,
        tag,
        content: defaultProcessedContent({
          slug,
          frontmatter: { title, tags: [], lang: language },
        }),
      }
    })
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function redirectPage(target: string): string {
  const safeTarget = escapeHtml(target)
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${safeTarget}"><link rel="canonical" href="${safeTarget}"><title>Redirecting…</title></head><body><a href="${safeTarget}">Continue</a></body></html>`
}

export const LocalizedTagPage: QuartzEmitterPlugin<Partial<LocalizedTagPageOptions>> = (
  userOpts,
) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: LocalizedTagContent({ sort: userOpts?.sort }),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "LocalizedTagPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    async *emit(ctx, content, resources) {
      const contentFiles = content.map((item) => item[1].data)
      const tagPages = createTagPages(contentFiles)
      const allFiles = [...contentFiles, ...tagPages.map((page) => page.content[1].data)]

      for (const page of tagPages) {
        const [tree, file] = page.content
        const slug = file.data.slug!
        const cfg = localizedConfiguration(ctx.cfg.configuration, page.language)
        const externalResources = pageResources(pathToRoot(slug), resources)
        const componentData: QuartzComponentProps = {
          ctx,
          fileData: file.data,
          externalResources,
          cfg,
          children: [],
          tree,
          allFiles,
        }

        const renderedPage = renderPage(cfg, slug, componentData, opts, externalResources)
        yield write({ ctx, content: renderedPage, slug, ext: ".html" })
      }

      const defaultLanguage = languageFromLocale(ctx.cfg.configuration.locale) ?? "es"
      const allTags = new Set(tagPages.map((page) => page.tag))
      for (const tag of allTags) {
        const slug = joinSegments("tags", tag) as FullSlug
        const target =
          tag === "index" ? `/${defaultLanguage}/tags/` : `/${defaultLanguage}/tags/${tag}`
        yield write({ ctx, content: redirectPage(target), slug, ext: ".html" })
      }
    },
  }
}
