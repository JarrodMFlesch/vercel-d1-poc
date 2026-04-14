import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { resolveD1Connection } from './utilities/d1Connection'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const d1Connection = await resolveD1Connection()

/** Dev: push schema. Prod: use `payload migrate` unless PAYLOAD_DB_PUSH overrides. */
function resolvePayloadDbPush(): boolean {
  const push = process.env.PAYLOAD_DB_PUSH?.trim().toLowerCase()
  return push === 'true' || process.env.NODE_ENV !== 'production'
}

const sqliteD1Options =
  d1Connection.mode === 'http'
    ? { http: d1Connection.http, push: resolvePayloadDbPush() }
    : { binding: d1Connection.binding, push: resolvePayloadDbPush() }

// Native `sharp` cannot load on Cloudflare Workers (no native addons). Official Payload D1 template omits it.
// Set `CF_WORKER=true` during `opennextjs-cloudflare build` (see package.json `deploy:app` / `preview:cf`).
const sharp =
  process.env.CF_WORKER === 'true'
    ? undefined
    : (await import('sharp')).default

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: sqliteD1Adapter(sqliteD1Options),
  collections: [Pages, Posts, Media, Categories, Users],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer],
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
