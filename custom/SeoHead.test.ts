import assert from "node:assert/strict"
import test from "node:test"
import { QuartzPluginData } from "../quartz/plugins/vfile"
import { FullSlug } from "../quartz/util/path"
import { articleDates, cleanPageUrl, getLanguageAlternates, safeJsonLd } from "./SeoHead"

function page(slug: string, translationId?: string): QuartzPluginData {
  return {
    slug: slug as FullSlug,
    frontmatter: {
      title: slug,
      ...(translationId ? { translation_id: translationId } : {}),
    },
  } as QuartzPluginData
}

test("cleanPageUrl emits Quartz's public root, folder, and article URLs", () => {
  assert.equal(cleanPageUrl("example.com", "index"), "https://example.com/")
  assert.equal(cleanPageUrl("example.com", "en/index"), "https://example.com/en/")
  assert.equal(
    cleanPageUrl("example.com", "en/tech/android-server"),
    "https://example.com/en/tech/android-server",
  )
  assert.equal(cleanPageUrl("https://", "en/index"), undefined)
})

test("getLanguageAlternates only emits complete reciprocal translation sets", () => {
  const english = page("en/guide", "guide")
  const spanish = page("es/guia", "guide")

  assert.deepEqual(getLanguageAlternates("example.com", english, [english, spanish]), [
    { language: "en", url: "https://example.com/en/guide" },
    { language: "es", url: "https://example.com/es/guia" },
  ])
  assert.deepEqual(getLanguageAlternates("example.com", english, [english]), [])
})

test("getLanguageAlternates maps the bilingual root to the localized home pages", () => {
  const root = page("index")
  const englishHome = page("en/index", "home")
  const spanishHome = page("es/index", "home")

  assert.deepEqual(getLanguageAlternates("example.com", root, [root, englishHome, spanishHome]), [
    { language: "en", url: "https://example.com/en/" },
    { language: "es", url: "https://example.com/es/" },
  ])
})

test("safeJsonLd round-trips data without leaving an injectable script terminator", () => {
  const value = { text: '</script><script>alert("x&y")</script>\u2028next\u2029line' }
  const serialized = safeJsonLd(value)

  assert.equal(serialized.toLowerCase().includes("</script>"), false)
  assert.equal(serialized.includes("\\u003c"), true)
  assert.equal(serialized.includes("\\u2028"), true)
  assert.deepEqual(JSON.parse(serialized), value)
})

test("articleDates uses the normalized Git modification date over the date alias", () => {
  const file = {
    frontmatter: {
      title: "Guide",
      date: "2026-07-25",
      modified: "2026-07-25",
    },
    dates: {
      created: new Date("2026-07-25T00:00:00.000Z"),
      published: new Date("2026-07-25T00:00:00.000Z"),
      modified: new Date("2026-07-27T16:35:59.000Z"),
    },
  } as QuartzPluginData

  assert.deepEqual(articleDates(file), {
    datePublished: "2026-07-25T00:00:00.000Z",
    dateModified: "2026-07-27T16:35:59.000Z",
  })
})
