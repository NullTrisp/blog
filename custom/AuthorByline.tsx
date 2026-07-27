import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "../quartz/components/types"
import { classNames } from "../quartz/util/lang"
import { languageFromLocale, languageFromSlug } from "./tagPaths"

export default (() => {
  const AuthorByline: QuartzComponent = ({ cfg, fileData, displayClass }: QuartzComponentProps) => {
    const author = fileData.frontmatter?.author
    if (
      typeof author !== "string" ||
      author.trim().length === 0 ||
      fileData.frontmatter?.translation_id === "about"
    ) {
      return null
    }

    const language = languageFromSlug(fileData.slug) ?? languageFromLocale(cfg.locale) ?? "es"
    const label = language === "es" ? "Por" : "By"
    const aboutPath = language === "es" ? "/es/sobre-mi" : "/en/about"

    return (
      <p class={classNames(displayClass, "article-byline")}>
        {label}{" "}
        <a class="internal" href={aboutPath}>
          {author}
        </a>
      </p>
    )
  }

  AuthorByline.css = `
.article-byline {
  margin-top: -0.5rem;
  margin-bottom: 0.25rem;
  color: var(--darkgray);
}
`

  return AuthorByline
}) satisfies QuartzComponentConstructor
