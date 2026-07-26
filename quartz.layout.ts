import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { withPageLocale } from "./custom/localization"
import { LocalizedTagList } from "./custom/tagLocalization"
import LocalizedGraph from "./custom/localizedGraph"
import LocalizedBreadcrumbs from "./custom/localizedBreadcrumbs"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: withPageLocale(Component.Head()),
  header: [Component.LanguageSwitcher()],
  afterBody: [],
  footer: withPageLocale(
    Component.Footer({
      links: {},
    }),
  ),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: LocalizedBreadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    withPageLocale(Component.ContentMeta()),
    LocalizedTagList,
  ],
  left: [
    withPageLocale(Component.PageTitle()),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: withPageLocale(Component.Search()),
          grow: true,
        },
        // { Component: Component.Darkmode() },
        // { Component: Component.ReaderMode() },
      ],
    }),
    withPageLocale(
      Component.Explorer({
        filterFn: (node: any) => {
          const path = window.location.pathname
          const lang = path.split("/")[1]
          const segments = ["en", "es"]
          if (segments.includes(lang)) {
            return node.slug.startsWith(lang)
          }
          return true
        },
      }),
    ),
  ],
  right: [
    withPageLocale(LocalizedGraph()),
    Component.DesktopOnly(withPageLocale(Component.TableOfContents())),
    withPageLocale(Component.Backlinks()),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    LocalizedBreadcrumbs(),
    Component.ArticleTitle(),
    withPageLocale(Component.ContentMeta()),
  ],
  left: [
    withPageLocale(Component.PageTitle()),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: withPageLocale(Component.Search()),
          grow: true,
        },
      ],
    }),
    withPageLocale(
      Component.Explorer({
        filterFn: (node: any) => {
          const path = window.location.pathname
          const lang = path.split("/")[1]
          const segments = ["en", "es"]
          if (segments.includes(lang)) {
            return node.slug.startsWith(lang)
          }
          return true
        },
      }),
    ),
  ],
  right: [],
}
