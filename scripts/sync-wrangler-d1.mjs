#!/usr/bin/env node
/**
 * Wrangler does not expand env vars inside wrangler.jsonc. This script writes
 * wrangler.jsonc from wrangler.template.jsonc using CLOUDFLARE_D1_DATABASE_ID
 * (same variable as HTTP D1 in d1Connection.ts).
 *
 * If the env var is missing (e.g. deploy shell without `.env`), we reuse a valid
 * `database_id` already present in `wrangler.jsonc` instead of clobbering it.
 */
import fs from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
config({ path: path.join(root, '.env') })

const templatePath = path.join(root, 'wrangler.template.jsonc')
const outPath = path.join(root, 'wrangler.jsonc')
const placeholder = '__CLOUDFLARE_D1_DATABASE_ID__'

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extractDatabaseIdFromFile(content) {
  const m = content.match(/"database_id"\s*:\s*"([^"]*)"/)
  return m?.[1] ?? ''
}

let text = fs.readFileSync(templatePath, 'utf8')
let id = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim()

if (!id && fs.existsSync(outPath)) {
  const existing = fs.readFileSync(outPath, 'utf8')
  const existingId = extractDatabaseIdFromFile(existing)
  if (existingId && uuidRe.test(existingId) && existingId !== placeholder) {
    id = existingId
    console.warn(
      `[sync-wrangler-d1] CLOUDFLARE_D1_DATABASE_ID not in env; keeping existing database_id from ${path.basename(outPath)}.`,
    )
  }
}

if (!id) {
  console.warn(
    `[sync-wrangler-d1] CLOUDFLARE_D1_DATABASE_ID not set; writing ${path.basename(outPath)} with placeholder (set .env or a real id in wrangler.jsonc).`,
  )
  fs.writeFileSync(outPath, text)
  process.exit(0)
}

if (!text.includes(placeholder)) {
  console.error(`[sync-wrangler-d1] Template missing ${placeholder} placeholder.`)
  process.exit(1)
}

text = text.replaceAll(placeholder, id)
fs.writeFileSync(outPath, text)
console.log(`[sync-wrangler-d1] Wrote ${path.basename(outPath)} using CLOUDFLARE_D1_DATABASE_ID.`)
