import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Nicolás Calvache",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "es-ES",
    baseUrl: "blog.nicolas-calvache.com",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: { name: "Plus Jakarta Sans", weights: [400, 600, 700, 800] },
        body: { name: "Manrope", weights: [300, 400, 500, 600], includeItalic: true },
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#162019",
          lightgray: "#1f2b20",
          gray: "#4a5243",
          darkgray: "#c2c9b7",
          dark: "#dee4db",
          secondary: "#9dd761",
          tertiary: "#b6d088",
          highlight: "rgba(157, 215, 97, 0.1)",
          textHighlight: "#9dd76155",
        },
        darkMode: {
          light: "#162019",
          lightgray: "#1f2b20",
          gray: "#4a5243",
          darkgray: "#c2c9b7",
          dark: "#dee4db",
          secondary: "#9dd761",
          tertiary: "#b6d088",
          highlight: "rgba(157, 215, 97, 0.1)",
          textHighlight: "#9dd76155",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
