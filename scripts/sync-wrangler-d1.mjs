#!/usr/bin/env node
/**
 * Wrangler does not expand env vars inside wrangler.jsonc. This script writes
 * wrangler.jsonc from wrangler.template.jsonc using CLOUDFLARE_D1_DATABASE_ID
 * (same variable as HTTP D1 in d1Connection.ts).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
config({ path: path.join(root, '.env') })

const templatePath = path.join(root, 'wrangler.template.jsonc')
const outPath = path.join(root, 'wrangler.jsonc')
const placeholder = '__CLOUDFLARE_D1_DATABASE_ID__'

let text = fs.readFileSync(templatePath, 'utf8')
const id = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim()

if (!id) {
  console.warn(
    `[sync-wrangler-d1] CLOUDFLARE_D1_DATABASE_ID not set; writing ${path.basename(outPath)} with placeholder (remote Wrangler commands need a real id).`,
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
