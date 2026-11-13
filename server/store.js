// Where the site keeps the little it keeps: the day's leaderboards and
// the day's anonymous totals.
//
// Everything is held in this service's memory. If a folder is given (a
// Railway volume, or DATA_DIR), each thing is also written there as a
// small JSON file, so a restart does not wipe the day. Without a folder
// the site works the same and simply starts empty after a restart.
//
// There is no database and no storage bucket. A name is one of the
// site's own (boards/keepy-2026-11-14, counts/2026-11-14), never
// anything a visitor sent.

import crypto from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export class StoreUnavailable extends Error {
  constructor(message, { cause } = {}) {
    super(message, { cause })
    this.name = 'StoreUnavailable'
  }
}

const NAME = /^(boards|counts)\/[a-z0-9]+(?:-[a-z0-9]+)*$/

// dir   the folder to keep files in, or null to keep things in memory only
export function createStore({ dir = null, log = console } = {}) {
  const memory = new Map()
  const root = dir ? path.resolve(dir) : null
  let usable = Boolean(root)
  if (root) {
    try {
      mkdirSync(path.join(root, 'boards'), { recursive: true })
      mkdirSync(path.join(root, 'counts'), { recursive: true })
    } catch (err) {
      usable = false
      log.warn?.(`The data folder ${root} cannot be used (${err.message}). Keeping things in memory only.`)
    }
  }
  const fileOf = (name) => path.join(root, `${name}.json`)
  const check = (name) => { if (!NAME.test(name)) throw new Error(`Not a name the store keeps: ${name}`) }

  return {
    // 'file' when things outlive a restart, 'memory' when they do not.
    kind: usable ? 'file' : 'memory',
    dir: usable ? root : null,

    // What is kept under a name, or null.
    async read(name) {
      check(name)
      if (memory.has(name)) return memory.get(name)
      if (!usable) return null
      try {
        const value = JSON.parse(await readFile(fileOf(name), 'utf8'))
        memory.set(name, value)
        return value
      } catch (err) {
        if (err.code === 'ENOENT' || err instanceof SyntaxError) return null
        throw new StoreUnavailable('The data folder did not answer', { cause: err })
      }
    },

    // Kept in memory at once, and written to its file through a
    // temporary one, so a file is never left half written.
    async write(name, value) {
      check(name)
      memory.set(name, value)
      if (!usable) return
      const file = fileOf(name)
      const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`
      try {
        await mkdir(path.dirname(file), { recursive: true })
        await writeFile(tmp, JSON.stringify(value))
        await rename(tmp, file)
      } catch (err) {
        rm(tmp, { force: true }).catch(() => {})
        throw new StoreUnavailable('The data folder did not take the change', { cause: err })
      }
    },

    // Forgets everything under a folder ('boards') that keep() does not
    // want kept. This is how yesterday's leaderboards are cleared.
    async prune(folder, keep) {
      for (const name of [...memory.keys()]) if (name.startsWith(`${folder}/`) && !keep(name)) memory.delete(name)
      if (!usable) return
      try {
        for (const f of await readdir(path.join(root, folder))) {
          const name = `${folder}/${f.replace(/\.json$/, '')}`
          if (!f.endsWith('.json') || !keep(name)) await rm(path.join(root, folder, f), { force: true })
        }
      } catch (err) {
        log.warn?.(`The data folder could not be tidied: ${err.message}`)
      }
    },

    // A secret that outlives a restart when there is a folder to keep it
    // in (the leaderboards sign their tickets with it), and one made
    // afresh for this run when there is not.
    secret(name = 'ticket') {
      if (usable) {
        const file = path.join(root, `${name}.key`)
        try {
          const kept = readFileSync(file, 'utf8').trim()
          if (/^[0-9a-f]{64}$/.test(kept)) return Buffer.from(kept, 'hex')
        } catch { /* none yet: one is made below */ }
        const fresh = crypto.randomBytes(32)
        try {
          writeFileSync(file, fresh.toString('hex'), { mode: 0o600 })
          return fresh
        } catch (err) {
          log.warn?.(`The ticket key could not be kept (${err.message}).`)
        }
      }
      return crypto.randomBytes(32)
    },
  }
}
