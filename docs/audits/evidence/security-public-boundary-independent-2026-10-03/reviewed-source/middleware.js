// Internal audit artifacts must be denied before Vercel's static filesystem/cache.
export const config = {
  runtime: 'nodejs',
  matcher: [
    '/docs/:path*',
    // Include URL-encoded root characters; ordinary application routes skip this.
    '/((?:d|%64)(?:o|%6[fF])(?:c|%63)(?:s|%73)/.*)',
  ],
};

export default function middleware() {
  return new Response('Not found', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
