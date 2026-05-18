const OR3_LOCAL_SERVICE_ORIGIN = 'http://127.0.0.1:9100';

const forwardedHeaders = [
    'accept',
    'authorization',
    'content-type',
    'x-or3-auth-method',
    'x-or3-session',
    'x-request-id',
    'x-trace-id',
];

const allowedProxyRoutes = new Map<string, Set<string>>([
    ['internal/v1/health', new Set(['GET', 'HEAD'])],
    ['internal/v1/pairing/requests', new Set(['POST'])],
    ['internal/v1/pairing/exchange', new Set(['POST'])],
    ['internal/v1/secure-connections/pairing/approve', new Set(['POST'])],
    ['internal/v1/secure-connections/pairing/exchange', new Set(['POST'])],
]);

export default defineEventHandler(async (event) => {
    const rawPath = String(event.context.params?.path || '').replace(/^\/+/, '');
    if (!rawPath.startsWith('internal/v1/')) {
        throw createError({ statusCode: 404, statusMessage: 'Not found' });
    }

    const method = getMethod(event).toUpperCase();
    if (!allowedProxyRoutes.get(rawPath)?.has(method)) {
        throw createError({ statusCode: 404, statusMessage: 'Not found' });
    }

    const requestUrl = getRequestURL(event);
    const target = `${OR3_LOCAL_SERVICE_ORIGIN}/${rawPath}${requestUrl.search}`;
    const incomingHeaders = getHeaders(event);
    const headers = new Headers();
    for (const name of forwardedHeaders) {
        const value = incomingHeaders[name];
        if (value) headers.set(name, value);
    }

    let body: BodyInit | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
        const contentType = String(incomingHeaders['content-type'] || '').toLowerCase();
        if (contentType && !contentType.includes('application/json')) {
            throw createError({ statusCode: 415, statusMessage: 'Only JSON pairing requests can use this proxy.' });
        }
        const rawBody = await readRawBody(event, 'utf8');
        body = rawBody || undefined;
    }

    let response: Response;
    try {
        response = await fetch(target, {
            method,
            headers,
            body,
            redirect: 'manual',
        });
    } catch {
        throw createError({
            statusCode: 502,
            statusMessage: 'OR3 service is not running on this computer.',
        });
    }

    const responseHeaders = new Headers();
    for (const name of [
        'content-type',
        'cache-control',
        'retry-after',
        'x-request-id',
        'x-trace-id',
    ]) {
        const value = response.headers.get(name);
        if (value) responseHeaders.set(name, value);
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    });
});
