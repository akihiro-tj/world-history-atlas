import {
  buildContentRangeHeader,
  byteRangeLength,
  resolveByteRange,
} from './range';

export interface Env {
  ASSETS: Fetcher;
  BUCKET: R2Bucket;
}

const R2_PATH_PREFIX = '/r2/';
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith(R2_PATH_PREFIX)) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      });
    }

    return serveFromR2(request, env, url);
  },
} satisfies ExportedHandler<Env>;

async function serveFromR2(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const key = url.pathname.slice(R2_PATH_PREFIX.length);
  if (key.length === 0) {
    return new Response('Not Found', { status: 404 });
  }

  const object = await env.BUCKET.get(key, {
    onlyIf: request.headers,
    range: request.headers,
  });

  if (object === null) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', IMMUTABLE_CACHE_CONTROL);

  if (!('body' in object) || object.body === undefined) {
    return new Response(null, { status: 412, headers });
  }

  const body = request.method === 'HEAD' ? null : object.body;
  const resolvedRange = resolveByteRange(object.range, object.size);

  if (resolvedRange === undefined) {
    headers.set('content-length', String(object.size));
    return new Response(body, { status: 200, headers });
  }

  headers.set(
    'content-range',
    buildContentRangeHeader(resolvedRange, object.size),
  );
  headers.set('content-length', String(byteRangeLength(resolvedRange)));
  return new Response(body, { status: 206, headers });
}
