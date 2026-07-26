import breadcrumbsStyle from "../quartz/components/styles/breadcrumbs.scss"
import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "../quartz/components/types"
import { classNames } from "../quartz/util/lang"
import {
  BreadcrumbNames,
  DEFAULT_BREADCRUMB_NAMES,
  getLocalizedBreadcrumbs,
} from "./breadcrumbPaths"
import { languageFromLocale, languageFromSlug } from "./tagPaths"

interface LocalizedBreadcrumbOptions {
  spacerSymbol: string
  names: BreadcrumbNames
  showCurrentPage: boolean
}

const defaultOptions: LocalizedBreadcrumbOptions = {
  spacerSymbol: "❯",
  names: DEFAULT_BREADCRUMB_NAMES,
  showCurrentPage: true,
}

export default ((opts?: Partial<LocalizedBreadcrumbOptions>) => {
  const options = {
    ...defaultOptions,
    ...opts,
    names: { ...defaultOptions.names, ...opts?.names },
  }

  const LocalizedBreadcrumbs: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    if (!fileData.slug) return null

    const language = languageFromSlug(fileData.slug) ?? languageFromLocale(cfg.locale) ?? "es"
    const crumbs = getLocalizedBreadcrumbs(
      fileData.slug,
      allFiles,
      cfg.locale,
      options.names,
      options.showCurrentPage,
    )

    return (
      <nav
        class={classNames(displayClass, "breadcrumb-container")}
        aria-label={language === "es" ? "migas de pan" : "breadcrumbs"}
      >
        {crumbs.map((crumb, index) => (
          <div class="breadcrumb-element">
            <a href={crumb.path}>{crumb.displayName}</a>
            {index !== crumbs.length - 1 && <p>{` ${options.spacerSymbol} `}</p>}
          </div>
        ))}
      </nav>
    )
  }

  LocalizedBreadcrumbs.css = breadcrumbsStyle
  return LocalizedBreadcrumbs
}) satisfies QuartzComponentConstructor<Partial<LocalizedBreadcrumbOptions> | undefined>
