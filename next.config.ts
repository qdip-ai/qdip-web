import type { NextConfig } from 'next'
import { PLATFORM_HOST_PATTERNS, PLATFORM_ORIGINS } from './src/routing-config'

const hasHost = (value: string) => [{ type: 'host' as const, value }]
const metadataPaths = ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest'] as const

/**
 * Static App Router pages emit Next.js hydration scripts inline.
 * 'unsafe-inline' is a documented compatibility exception, not a strict XSS CSP.
 * A nonce policy requires a separately approved dynamic-rendering change.
 */
export function buildContentSecurityPolicy(isDevelopment: boolean): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (isDevelopment ? " 'unsafe-eval'" : ''),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://doctor.qdip.ai https://tile.openstreetmap.org" + (isDevelopment ? ' ws: wss:' : ''),
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

const nextConfig: NextConfig = {
  transpilePackages: ['@qdip/client'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // API routes may return their own more restrictive CSP (OIDC error HTML).
        source: '/((?!api/).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy(process.env.NODE_ENV === 'development'),
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        // Railway's *.qdip.ai fallback must not serve the site on unknown hostnames.
        source: '/:path*',
        has: hasHost('^(?:[a-z0-9-]+\\.)+qdip\\.ai$'),
        missing: [
          ...hasHost(PLATFORM_HOST_PATTERNS.site),
          ...hasHost(PLATFORM_HOST_PATTERNS.studio),
          ...hasHost(PLATFORM_HOST_PATTERNS.observatory),
        ],
        destination: 'https://qdip.ai',
        permanent: true,
      },
      {
        source: '/sdk',
        has: hasHost(PLATFORM_HOST_PATTERNS.site),
        destination: PLATFORM_ORIGINS.site + '/en/sdk',
        permanent: true,
      },
      {
        source: '/',
        has: hasHost(PLATFORM_HOST_PATTERNS.studio),
        destination: '/en/profiles',
        permanent: true,
      },
      {
        source: '/',
        has: hasHost(PLATFORM_HOST_PATTERNS.observatory),
        destination: '/en',
        permanent: true,
      },
      {
        source: '/decisions',
        has: hasHost(PLATFORM_HOST_PATTERNS.observatory),
        destination: '/en/decisions',
        permanent: true,
      },

      {
        source: '/platform/:locale(en|uk|pl)',
        destination: `${PLATFORM_ORIGINS.site}/:locale`,
        permanent: true,
      },
      {
        source: '/platform/:locale(en|uk|pl)/:path*',
        destination: `${PLATFORM_ORIGINS.site}/:locale/:path*`,
        permanent: true,
      },

      {
        source: '/studio',
        has: [{ type: 'query', key: 'lang', value: '(?<legacyLocale>en|uk|pl)' }],
        destination: `${PLATFORM_ORIGINS.studio}/:legacyLocale/profiles`,
        permanent: true,
      },
      {
        source: '/studio/:path*',
        has: [{ type: 'query', key: 'lang', value: '(?<legacyLocale>en|uk|pl)' }],
        destination: `${PLATFORM_ORIGINS.studio}/:legacyLocale/:path*`,
        permanent: true,
      },
      {
        source: '/studio',
        destination: `${PLATFORM_ORIGINS.studio}/en/profiles`,
        permanent: true,
      },
      {
        source: '/studio/:path*',
        destination: `${PLATFORM_ORIGINS.studio}/en/:path*`,
        permanent: true,
      },

      {
        source: '/observatory',
        destination: `${PLATFORM_ORIGINS.observatory}/en`,
        permanent: true,
      },
      {
        source: '/observatory/:path*',
        destination: `${PLATFORM_ORIGINS.observatory}/en/:path*`,
        permanent: true,
      },

      ...metadataPaths.flatMap((source) => [
        {
          source,
          has: hasHost(PLATFORM_HOST_PATTERNS.studio),
          destination: `${PLATFORM_ORIGINS.site}${source}`,
          permanent: true,
        },
        {
          source,
          has: hasHost(PLATFORM_HOST_PATTERNS.observatory),
          destination: `${PLATFORM_ORIGINS.site}${source}`,
          permanent: true,
        },
      ]),
    ]
  },

  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/:locale(en|uk|pl)',
          has: hasHost(PLATFORM_HOST_PATTERNS.site),
          destination: '/platform/:locale',
        },
        {
          source: '/:locale(en|uk|pl)/:path*',
          has: hasHost(PLATFORM_HOST_PATTERNS.site),
          destination: '/platform/:locale/:path*',
        },
        {
          source: '/:locale(en|uk|pl)',
          has: hasHost(PLATFORM_HOST_PATTERNS.studio),
          destination: '/studio?lang=:locale',
        },
        {
          source: '/:locale(en|uk|pl)/:path*',
          has: hasHost(PLATFORM_HOST_PATTERNS.studio),
          destination: '/studio/:path*?lang=:locale&route=:path*',
        },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig
