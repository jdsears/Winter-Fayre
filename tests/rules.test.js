// The repository's writing rules (CLAUDE.md), checked:
//   no em or en dash anywhere we write;
//   no spaced hyphen in comments, docs or the words on a page, scores
//   written "2 - 2" being the one exception;
//   no model names, and no secrets in the example settings.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { ROOT, PAGES, startApp } from './support/helpers.js'

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'fonts', 'screenshots'])
function files(dir = ROOT) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name === 'package-lock.json') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...files(full))
    else if (/\.(js|mjs|cjs|json|md|toml|txt|yml)$|^\.env\.example$|^\.gitignore$/.test(name)) out.push(full)
  }
  return out
}

// The dashes and a model's name, written by their parts so this file has
// none of them itself.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
const MODEL = new RegExp(['cla', 'ude-(?:opus|sonnet|haiku|instant|[0-9])'].join(''), 'i')
// A spaced hyphen that is not a score ("2 - 2").
function spacedHyphen(s) {
  for (const m of s.matchAll(/(\S?)\s+-\s+(\S?)/g)) {
    if (!(/\d/.test(m[1]) && /\d/.test(m[2]))) return true
  }
  return false
}

test('no em or en dash in anything we write', () => {
  for (const f of files()) assert.ok(!DASHES.test(readFileSync(f, 'utf8')), path.relative(ROOT, f))
})

test('no model names anywhere', () => {
  for (const f of files()) assert.ok(!MODEL.test(readFileSync(f, 'utf8')), path.relative(ROOT, f))
})

test('no spaced hyphen in comments or docs', () => {
  for (const f of files()) {
    const rel = path.relative(ROOT, f)
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((line, i) => {
      let words = null
      if (rel.endsWith('.md')) words = line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '').replace(/`[^`]*`/g, '')
      else if (/\.(js|mjs|cjs)$/.test(rel)) words = /^\s*\/\//.test(line) ? line : null
      if (words !== null) assert.ok(!spacedHyphen(words), `${rel}:${i + 1}: ${line.trim().slice(0, 90)}`)
    })
  }
})

test('the words on every page keep the rules too', async () => {
  const app = await startApp()
  try {
    for (const p of [...PAGES, '/nowhere']) {
      const html = await (await app.get(p)).text()
      const words = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '\n').replace(/&[a-z#0-9]+;/g, ' ')
      assert.ok(!DASHES.test(words), p)
      for (const line of words.split('\n')) assert.ok(!spacedHyphen(line), `${p}: "${line.trim()}"`)
    }
  } finally {
    await app.close()
  }
})

test('the example settings name the variables and hold no secret', () => {
  const lines = readFileSync(path.join(ROOT, '.env.example'), 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l))
  const names = lines.map(l => l.split('=')[0])
  for (const n of ['SITE_ORIGIN', 'NODE_ENV', 'NUMBERS_PASSWORD', 'DATA_DIR', 'PORT']) assert.ok(names.includes(n), n)
  for (const l of lines) assert.equal(l.split('=').slice(1).join('='), '', `${l.split('=')[0]} should be empty in the example`)
})
