import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.__NEXT_PRIVATE_ORIGIN ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'http://localhost:3000'

const isCloudflareWorkerBuild = process.env.CF_WORKER === 'true'

const nextConfig: NextConfig = {
  // Workerd-specific packages — https://opennext.js.org/cloudflare/howtos/workerd
  // `sharp` is omitted for CF Worker builds (native .node binaries); see payload.config.ts + CF_WORKER.
  serverExternalPackages: ['jose', 'pg-cloudflare', ...(isCloudflareWorkerBuild ? [] : ['sharp'])],
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    qualities: [100],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        }
      }),
    ],
  },
  webpack: (webpackConfig, { webpack }) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    if (isCloudflareWorkerBuild) {
      webpackConfig.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^sharp$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /@img\/sharp-/ }),
      )
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
