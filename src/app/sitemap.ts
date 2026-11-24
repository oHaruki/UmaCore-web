import type { MetadataRoute } from 'next'
import { query } from '@/lib/db'
import { listClubPosts } from '@/lib/recruiting'
import { clubPostPath } from '@/lib/recruiting-shared'

// listings come and go, so build it per request instead of at image build time
export const dynamic = 'force-dynamic'

const base = 'https://umacore.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [clubs, alliances] = await Promise.all([
    listClubPosts().catch(() => []),
    query<{ slug: string }>(`SELECT slug FROM alliances WHERE is_public`).catch(() => []),
  ])

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/recruiting`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    ...clubs.map(c => ({
      url: `${base}${clubPostPath(c)}`,
      lastModified: new Date(c.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...alliances.map(a => ({
      url: `${base}/alliance/${a.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]
}
