import { ComponentChildren } from "preact"
import { Root } from "hast"
import { GlobalConfiguration } from "../quartz/cfg"
import { Date as DateComponent, getDate } from "../quartz/components/Date"
import { byDateAndAlphabeticalFolderFirst, SortFn } from "../quartz/components/PageList"
import CoreTagList from "../quartz/components/TagList"
import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "../quartz/components/types"
import listPageStyle from "../quartz/components/styles/listPage.scss"
import { i18n } from "../quartz/i18n"
import { QuartzPluginData } from "../quartz/plugins/vfile"
import { htmlToJsx } from "../quartz/util/jsx"
import { classNames } from "../quartz/util/lang"
import { FullSlug, getAllSegmentPrefixes, joinSegments, resolveRelative } from "../quartz/util/path"
import { concatenateResources } from "../quartz/util/resources"
import { trieFromAllFiles } from "../quartz/util/ctx"
import {
  getLocalizedTagSlug,
  languageFromSlug,
  parseLocalizedTagSlug,
  TagLanguage,
} from "./tagPaths"

export const LocalizedTagList: QuartzComponent = ({
  fileData,
  displayClass,
  cfg,
}: QuartzComponentProps) => {
  const tags = fileData.frontmatter?.tags
  if (!fileData.slug || !tags || tags.length === 0) return null

  return (
    <ul class={classNames(displayClass, "tags")}>
      {tags.map((tag) => {
        const target = getLocalizedTagSlug(fileData.slug, tag, cfg.locale)
        return (
          <li>
            <a href={resolveRelative(fileData.slug!, target)} class="internal tag-link">
              {tag}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

LocalizedTagList.css = CoreTagList().css

type LocalizedPageListProps = {
  limit?: number
  sort?: SortFn
} & QuartzComponentProps

export const LocalizedPageList: QuartzComponent = ({
  cfg,
  fileData,
  allFiles,
  limit,
  sort,
}: LocalizedPageListProps) => {
  const sorter = sort ?? byDateAndAlphabeticalFolderFirst(cfg)
  let pages = [...allFiles].sort(sorter)
  if (limit) pages = pages.slice(0, limit)

  return (
    <ul class="section-ul">
      {pages.map((page) => {
        const title = page.frontmatter?.title
        const tags = page.frontmatter?.tags ?? []

        return (
          <li class="section-li">
            <div class="section">
              <p class="meta">
                {page.dates && <DateComponent date={getDate(cfg, page)!} locale={cfg.locale} />}
              </p>
              <div class="desc">
                <h3>
                  <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal">
                    {title}
                  </a>
                </h3>
              </div>
              <ul class="tags">
                {tags.map((tag) => {
                  const target = getLocalizedTagSlug(fileData.slug, tag, cfg.locale)
                  return (
                    <li>
                      <a class="internal tag-link" href={resolveRelative(fileData.slug!, target)}>
                        {tag}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

LocalizedPageList.css = `
.section h3 {
  margin: 0;
}

.section > .tags {
  margin: 0;
}
`

interface FolderContentOptions {
  showFolderCount: boolean
  showSubfolders: boolean
  sort?: SortFn
}

const defaultFolderOptions: FolderContentOptions = {
  showFolderCount: true,
  showSubfolders: true,
}

export const LocalizedFolderContent = ((opts?: Partial<FolderContentOptions>) => {
  const options = { ...defaultFolderOptions, ...opts }

  const FolderContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { tree, fileData, allFiles, cfg } = props
    const trie = (props.ctx.trie ??= trieFromAllFiles(allFiles))
    const folder = trie.findNode(fileData.slug!.split("/"))
    if (!folder) return null

    const allPagesInFolder: QuartzPluginData[] =
      folder.children
        .map((node) => {
          if (node.data) return node.data

          if (node.isFolder && options.showSubfolders) {
            const getMostRecentDates = (): QuartzPluginData["dates"] => {
              let maybeDates: QuartzPluginData["dates"] | undefined = undefined
              for (const child of node.children) {
                if (child.data?.dates) {
                  if (!maybeDates) {
                    maybeDates = { ...child.data.dates }
                  } else {
                    if (child.data.dates.created > maybeDates.created) {
                      maybeDates.created = child.data.dates.created
                    }
                    if (child.data.dates.modified > maybeDates.modified) {
                      maybeDates.modified = child.data.dates.modified
                    }
                    if (child.data.dates.published > maybeDates.published) {
                      maybeDates.published = child.data.dates.published
                    }
                  }
                }
              }

              return (
                maybeDates ?? {
                  created: new Date(),
                  modified: new Date(),
                  published: new Date(),
                }
              )
            }

            return {
              slug: node.slug,
              dates: getMostRecentDates(),
              frontmatter: { title: node.displayName, tags: [] },
            }
          }
        })
        .filter((page) => page !== undefined) ?? []

    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
    const content = (
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)
    ) as ComponentChildren

    return (
      <div class="popover-hint">
        <article class={cssClasses.join(" ")}>{content}</article>
        <div class="page-listing">
          {options.showFolderCount && (
            <p>
              {i18n(cfg.locale).pages.folderContent.itemsUnderFolder({
                count: allPagesInFolder.length,
              })}
            </p>
          )}
          <div>
            <LocalizedPageList {...props} allFiles={allPagesInFolder} sort={options.sort} />
          </div>
        </div>
      </div>
    )
  }

  FolderContent.css = concatenateResources(listPageStyle, LocalizedPageList.css)
  return FolderContent
}) satisfies QuartzComponentConstructor<Partial<FolderContentOptions> | undefined>

interface TagContentOptions {
  sort?: SortFn
  numPages: number
}

const defaultTagOptions: TagContentOptions = {
  numPages: 10,
}

export const LocalizedTagContent = ((opts?: Partial<TagContentOptions>) => {
  const options = { ...defaultTagOptions, ...opts }

  const TagContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { tree, fileData, allFiles, cfg } = props
    const parsedSlug = parseLocalizedTagSlug(fileData.slug)
    if (!parsedSlug) {
      throw new Error(
        `LocalizedTagContent tried to render a non-localized tag page: ${fileData.slug}`,
      )
    }

    const { language, tag } = parsedSlug
    const languageFiles = allFiles.filter((file) => languageFromSlug(file.slug) === language)
    const allPagesWithTag = (currentTag: string) =>
      languageFiles.filter((file) =>
        (file.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes).includes(currentTag),
      )

    const content = (
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)
    ) as ComponentChildren
    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []

    if (tag === "/") {
      const tags = [
        ...new Set(
          languageFiles
            .flatMap((data) => data.frontmatter?.tags ?? [])
            .flatMap(getAllSegmentPrefixes),
        ),
      ].sort((a, b) => a.localeCompare(b))

      return (
        <div class="popover-hint">
          <article class={cssClasses.join(" ")}>
            <p>{content}</p>
          </article>
          <p>{i18n(cfg.locale).pages.tagContent.totalTags({ count: tags.length })}</p>
          <div>
            {tags.map((currentTag) => {
              const pages = allPagesWithTag(currentTag)
              const href = resolveRelative(
                fileData.slug!,
                joinSegments(language, "tags", currentTag) as FullSlug,
              )

              return (
                <div>
                  <h2>
                    <a class="internal tag-link" href={href}>
                      {currentTag}
                    </a>
                  </h2>
                  <div class="page-listing">
                    <p>
                      {i18n(cfg.locale).pages.tagContent.itemsUnderTag({ count: pages.length })}
                      {pages.length > options.numPages && (
                        <>
                          {" "}
                          <span>
                            {i18n(cfg.locale).pages.tagContent.showingFirst({
                              count: options.numPages,
                            })}
                          </span>
                        </>
                      )}
                    </p>
                    <LocalizedPageList
                      limit={options.numPages}
                      {...props}
                      allFiles={pages}
                      sort={options.sort}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    const pages = allPagesWithTag(tag)
    return (
      <div class="popover-hint">
        <article class={cssClasses.join(" ")}>{content}</article>
        <div class="page-listing">
          <p>{i18n(cfg.locale).pages.tagContent.itemsUnderTag({ count: pages.length })}</p>
          <div>
            <LocalizedPageList {...props} allFiles={pages} sort={options.sort} />
          </div>
        </div>
      </div>
    )
  }

  TagContent.css = concatenateResources(listPageStyle, LocalizedPageList.css)
  return TagContent
}) satisfies QuartzComponentConstructor<Partial<TagContentOptions> | undefined>

export function localizedConfiguration(
  cfg: GlobalConfiguration,
  language: TagLanguage,
): GlobalConfiguration {
  const locale = language === "en" ? "en-US" : "es-ES"
  return cfg.locale === locale ? cfg : { ...cfg, locale }
}
