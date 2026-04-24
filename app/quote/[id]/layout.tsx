import { Metadata } from 'next'
import { getSupabase } from '@/lib/supabase'

type Props = {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const baseUrl = 'https://quotes.thwreckers.com.au'
  const ogImageUrl = `${baseUrl}/og-image.png`

  try {
    const { id } = await params
    const db = getSupabase()

    const { data: request } = await db
      .from('requests')
      .select('title, description')
      .eq('id', id)
      .single()

    if (request) {
      const title = `${request.title} - Supplier Quote`
      const description = request.description || `Submit your quote for ${request.title}`

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: 'website',
          url: `${baseUrl}/quote/${id}`,
          siteName: 'Supplier Quote System',
          images: [
            {
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          image: ogImageUrl,
        },
      }
    }

    return {
      title: 'Submit a Quote',
      description: 'Submit your quote for this request',
    }
  } catch (error) {
    return {
      title: 'Submit a Quote',
      description: 'Submit your quote for this request',
    }
  }
}

export default function Layout({ children }: Props) {
  return <>{children}</>
}
