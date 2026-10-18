import { NextRequest, NextResponse } from 'next/server'
import { adminRequest } from '@/lib/observatory-plugin-admin'
import { coreCatalogClient, readCorePublications } from '@/lib/observatory-plugin-catalog'
import { QdipError } from '@qdip/client'
import { validPublicApplicationUrl } from '@/lib/observatory-plugin-launch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { error, session } = adminRequest(request, true)
  if (error) return error
  if (!session) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const { name } = await context.params
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(name))
    return NextResponse.json({ error: 'Invalid plugin id' }, { status: 400 })

  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    return NextResponse.json({ error: 'JSON required' }, { status: 415 })
  let update: {
    published?: unknown
    expected_revision?: unknown
    capability_id?: unknown
    display_name?: unknown
    description?: unknown
    category?: unknown
    slug?: unknown
    application_url?: unknown
  }
  try {
    const raw = await request.text()
    if (raw.length > 4096) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    update = JSON.parse(raw) as typeof update
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (
    typeof update.published !== 'boolean' ||
    typeof update.expected_revision !== 'number' ||
    !Number.isSafeInteger(update.expected_revision) ||
    (update.expected_revision as number) < 0
  )
    return NextResponse.json({ error: 'Invalid publication request' }, { status: 422 })

  try {
    const catalog = await readCorePublications()
    const installed = catalog.find((item) => item.name === name)
    if (!installed) return NextResponse.json({ error: 'Plugin not installed' }, { status: 404 })
    // Runtime registration belongs to QDIP Core. Observatory registers only
    // a catalog entry for a plugin/capability already installed and verified.
    const capability =
      typeof update.capability_id === 'string'
        ? update.capability_id
        : (installed.capability_id ?? installed.capabilities[0])
    if (!capability || !installed.capabilities.includes(capability))
      return NextResponse.json({ error: 'Capability is not installed' }, { status: 409 })
    if (update.published && !installed.enabled)
      return NextResponse.json({ error: 'Disabled plugin cannot be published' }, { status: 409 })
    const displayName = update.display_name
    const description = update.description
    const category = update.category
    const slug = update.slug
    const applicationUrl = update.application_url
    if (
      displayName !== undefined &&
      (typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.length > 120)
    )
      return NextResponse.json({ error: 'Invalid display name' }, { status: 422 })
    if (description !== undefined && (typeof description !== 'string' || description.length > 2000))
      return NextResponse.json({ error: 'Invalid description' }, { status: 422 })
    if (category !== undefined && (typeof category !== 'string' || !/^[A-Za-z0-9 _.-]{1,64}$/.test(category)))
      return NextResponse.json({ error: 'Invalid category' }, { status: 422 })
    if (
      slug !== undefined &&
      (typeof slug !== 'string' ||
        !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug) ||
        slug.includes('--') ||
        ['admin', 'api', 'new', 'edit', 'plugins', 'settings'].includes(slug))
    )
      return NextResponse.json({ error: 'Invalid URL slug' }, { status: 422 })
    if (applicationUrl !== undefined && (typeof applicationUrl !== 'string' ||
        (applicationUrl !== '' && !validPublicApplicationUrl(applicationUrl))))
      return NextResponse.json({ error: 'Invalid application URL' }, { status: 422 })
    const conflicting =
      typeof slug === 'string' &&
      catalog.some(
        (other) =>
          other.name !== name && (other.name === slug || other.slug === slug || other.slug_aliases?.includes(slug))
      )
    if (conflicting) return NextResponse.json({ error: 'Public URL already in use' }, { status: 409 })
    const updated = await coreCatalogClient().catalog.publish(name, {
      published: update.published,
      expectedRevision: update.expected_revision,
      capabilityId: capability,
      pluginVersion: installed.version,
      actor: session.sub,
      ...(displayName !== undefined ? { displayName: (displayName as string).trim() } : {}),
      ...(description !== undefined ? { description: (description as string).trim() } : {}),
      ...(category !== undefined ? { category: (category as string).trim() } : {}),
      ...(slug !== undefined ? { slug: slug as string } : {}),
      ...(applicationUrl !== undefined ? { applicationUrl: applicationUrl as string } : {}),
    })
    return NextResponse.json(updated, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (cause) {
    if (cause instanceof QdipError) {
      if (cause.httpStatus === 409)
        return NextResponse.json({ error: 'Registry changed. Reload and retry.' }, { status: 409 })
      if (cause.httpStatus === 401 || cause.httpStatus === 403)
        return NextResponse.json({ error: 'QDIP Core administrative credential rejected' }, { status: 502 })
      if (cause.httpStatus === 400 || cause.httpStatus === 422)
        return NextResponse.json({ error: 'Invalid plugin publication' }, { status: 422 })
    }
    return NextResponse.json({ error: 'QDIP Core unavailable' }, { status: 503 })
  }
}
