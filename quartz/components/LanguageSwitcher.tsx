import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const LanguageSwitcher: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <div class={classNames(displayClass, "language-switcher")}>
      <a href="/en/" class="lang-link" data-lang="en">EN</a>
      <span>|</span>
      <a href="/es/" class="lang-link" data-lang="es">ES</a>
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

.language-switcher a {
  text-decoration: none;
  color: var(--gray);
  transition: color 0.2s ease;
}

.language-switcher a:hover {
  color: var(--secondary);
}

.language-switcher a.active {
  color: var(--secondary);
  pointer-events: none;
}
`

const script = `
document.addEventListener("nav", () => {
  const path = window.location.pathname
  const lang = path.split("/")[1]
  const links = document.querySelectorAll(".language-switcher a")
  links.forEach(link => {
    const dataLang = link.getAttribute("data-lang")
    if (dataLang === lang) {
      link.classList.add("active")
    } else {
      link.classList.remove("active")
      // Update link to point to the same page in another language if possible
      // This is a simple implementation that just changes the prefix
      const restOfPath = path.split("/").slice(2).join("/")
      link.href = "/" + dataLang + "/" + restOfPath
    }
  })
})
`

LanguageSwitcher.afterDOMLoaded = script

export default (() => LanguageSwitcher) satisfies QuartzComponentConstructor
