import assert from "node:assert"
import { describe, test } from "node:test"
import { getPageLocale } from "./localization"

describe("getPageLocale", () => {
  test("uses the language prefix from a localized slug", () => {
    assert.strictEqual(getPageLocale("es-ES", { slug: "en/tech/android-server" }), "en-US")
    assert.strictEqual(getPageLocale("es-ES", { slug: "es/tech/servidor-android" }), "es-ES")
  })

  test("prefers an explicit frontmatter language", () => {
    assert.strictEqual(
      getPageLocale("es-ES", {
        slug: "es/tech/android-server",
        frontmatter: { lang: "en-GB" },
      }),
      "en-GB",
    )
  })

  test("falls back to the configured locale for an unlocalized slug", () => {
    assert.strictEqual(getPageLocale("es-ES", { slug: "about" }), "es-ES")
  })
})
