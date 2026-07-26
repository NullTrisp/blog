import { buildSync } from "esbuild"
import { dirname, resolve } from "node:path"
import { readFileSync } from "node:fs"

function replaceRequired(source: string, search: string, replacement: string): string {
  if (!source.includes(search)) {
    throw new Error("Could not adapt Quartz Graph: an expected source block has changed")
  }

  return source.replace(search, replacement)
}

/**
 * Adapt Quartz's graph at build time without changing its core source.
 * The replacements deliberately fail if an upstream Quartz update changes
 * one of the relevant blocks, instead of silently losing language filtering.
 */
export function localizeGraphSource(rawSource: string): string {
  let source = rawSource.replaceAll("\r\n", "\n")

  source = replaceRequired(
    source,
    `  const data: Map<SimpleSlug, ContentDetails> = new Map(
    Object.entries<ContentDetails>(await fetchData).map(([k, v]) => [
      simplifySlug(k as FullSlug),
      v,
    ]),
  )`,
    `  const supportedLanguages = ["en", "es"]
  const pageLanguage =
    supportedLanguages.find((language) => slug.startsWith(language + "/")) ??
    supportedLanguages.find((language) => document.documentElement.lang.startsWith(language)) ??
    "es"
  const tagPrefix = pageLanguage + "/tags/"
  const localizedEntries = Object.entries<ContentDetails>(await fetchData).filter(([key]) =>
    simplifySlug(key as FullSlug).startsWith(pageLanguage + "/"),
  )
  const data: Map<SimpleSlug, ContentDetails> = new Map(
    localizedEntries.map(([k, v]) => [simplifySlug(k as FullSlug), v]),
  )`,
  )

  source = replaceRequired(
    source,
    `.map((tag) => simplifySlug(("tags/" + tag) as FullSlug))`,
    `.map((tag) => simplifySlug((tagPrefix + tag) as FullSlug))`,
  )

  source = replaceRequired(
    source,
    `    const text = url.startsWith("tags/") ? "#" + url.substring(5) : (data.get(url)?.title ?? url)`,
    `    const text = url.startsWith(tagPrefix)
      ? "#" + url.substring(tagPrefix.length)
      : (data.get(url)?.title ?? url)`,
  )

  source = replaceRequired(source, `d.id.startsWith("tags/")`, `d.id.startsWith(tagPrefix)`)

  source = replaceRequired(
    source,
    `const isTagNode = nodeId.startsWith("tags/")`,
    `const isTagNode = nodeId.startsWith(tagPrefix)`,
  )

  return source
}

export function buildLocalizedGraphScript(): string {
  const sourcePath = resolve("quartz/components/scripts/graph.inline.ts")
  const source = localizeGraphSource(readFileSync(sourcePath, "utf8"))
  const result = buildSync({
    stdin: {
      contents: source,
      loader: "ts",
      resolveDir: dirname(sourcePath),
      sourcefile: sourcePath,
    },
    write: false,
    bundle: true,
    minify: true,
    platform: "browser",
    format: "esm",
  })

  return result.outputFiles[0].text
}
