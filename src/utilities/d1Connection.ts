import fs from 'fs'
import path from 'path'
import type { CloudflareContext } from '@opennextjs/cloudflare'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { GetPlatformProxyOptions } from 'wrangler'

type SqliteD1AdapterArgs = Parameters<
  (typeof import('@payloadcms/db-d1-sqlite'))['sqliteD1Adapter']
>[0]

export type ResolvedD1Connection =
  | { mode: 'http'; http: NonNullable<SqliteD1AdapterArgs['http']> }
  | { mode: 'binding'; binding: NonNullable<SqliteD1AdapterArgs['binding']> }

const realpath = (value: string) => (fs.existsSync(value) ? fs.realpathSync(value) : undefined)

/** Payload CLI (migrate, generate, etc.) */
const isCLI = process.argv.some((value) => {
  const rp = realpath(value)
  return rp?.endsWith(path.join('payload', 'bin.js')) ?? false
})

const isProduction = process.env.NODE_ENV === 'production'

/**
 * HTTP: `CLOUDFLARE_CONNECTION_TYPE=http`, or legacy three Cloudflare REST vars (Node / Vercel).
 * Binding: `CLOUDFLARE_CONNECTION_TYPE=binding` skips HTTP even if REST vars exist (OpenNext / Workers).
 */
function shouldUseHttp(): boolean {
  const t = process.env.CLOUDFLARE_CONNECTION_TYPE?.trim().toLowerCase()
  if (t === 'binding') return false
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_API_TOKEN &&
    process.env.CLOUDFLARE_D1_DATABASE_ID,
  )
}

// Adapted from opennextjs-cloudflare (Payload with-cloudflare-d1 template)
async function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  const { getPlatformProxy } = await import(
    /* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`
  )
  return getPlatformProxy({
    environment: process.env.CLOUDFLARE_ENV,
    remoteBindings: isProduction,
  } satisfies GetPlatformProxyOptions)
}

/**
 * Resolves D1 for `@payloadcms/db-d1-sqlite`:
 * - **HTTP** — Cloudflare REST API (local dev, Vercel, any Node without a D1 binding).
 * - **Binding** — `getCloudflareContext` / Wrangler `getPlatformProxy` (OpenNext on Cloudflare, `payload` CLI with wrangler.jsonc).
 */
export async function resolveD1Connection(): Promise<ResolvedD1Connection> {
  if (shouldUseHttp()) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
    if (!accountId || !apiToken || !databaseId) {
      throw new Error(
        'HTTP D1 requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID (or set CLOUDFLARE_CONNECTION_TYPE=binding and use wrangler).',
      )
    }
    return {
      mode: 'http',
      http: { accountId, apiToken, databaseId },
    }
  }

  const cloudflare: CloudflareContext =
    isCLI || !isProduction
      ? await getCloudflareContextFromWrangler()
      : await getCloudflareContext({ async: true })

  const binding = cloudflare.env.D1
  if (!binding) {
    throw new Error(
      'D1 binding not found on cloudflare.env. For OpenNext, ensure wrangler.jsonc binds D1. For HTTP from Node, set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID.',
    )
  }

  return { mode: 'binding', binding }
}
