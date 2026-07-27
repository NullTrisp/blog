import assert from "node:assert/strict"
import test from "node:test"
import { getTagRedirectLanguage } from "./tagPaths"

const pages = [
  { language: "en" as const, tag: "english-only" },
  { language: "en" as const, tag: "shared" },
  { language: "es" as const, tag: "shared" },
]

test("tag redirects prefer the configured language when that localized tag exists", () => {
  assert.equal(getTagRedirectLanguage(pages, "shared", "es"), "es")
})

test("tag redirects fall back to a language where the tag exists", () => {
  assert.equal(getTagRedirectLanguage(pages, "english-only", "es"), "en")
})
