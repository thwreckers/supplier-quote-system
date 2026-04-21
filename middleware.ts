import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD

  // If no password is configured, block access entirely
  if (!adminPassword) {
    return new NextResponse('ADMIN_PASSWORD environment variable is not set.', { status: 500 })
  }

  // Check Basic Auth header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Basic ')) {
    const base64 = authHeader.slice(6)
    const decoded = Buffer.from(base64, 'base64').toString('utf-8')
    // Format is "username:password" — we only care about the password
    const password = decoded.split(':').slice(1).join(':')
    if (password === adminPassword) {
      return NextResponse.next()
    }
  }

  // Not authenticated — prompt browser for Basic Auth credentials
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin Area"',
    },
  })
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
