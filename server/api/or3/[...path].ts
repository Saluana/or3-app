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

const allowedMethods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);

function publicProxyRoute(path: string, method: string) {
    if ((method === 'GET' || method === 'HEAD') && (
        path === 'internal/v1/health' ||
        path === 'internal/v1/readiness' ||
        path === 'internal/v1/capabilities' ||
        path === 'internal/v1/auth/capabilities' ||
        path === 'internal/v1/secure-connections/capabilities'
    )) {
        return true;
    }
    return method === 'POST' && (
        path === 'internal/v1/pairing/requests' ||
        path === 'internal/v1/pairing/exchange' ||
        path === 'internal/v1/secure-connections/pairing/approve' ||
        path === 'internal/v1/secure-connections/pairing/exchange' ||
        path === 'internal/v1/secure-connections/sessions'
    );
}

function hasProxyAuth(headers: Record<string, string | string[] | undefined>) {
    return Boolean(headers.authorization || headers['x-or3-session']);
}

export default defineEventHandler(async (event) => {
    const rawPath = String(event.context.params?.path || '').replace(/^\/+/, '');
    if (!rawPath.startsWith('internal/v1/')) {
        throw createError({ statusCode: 404, statusMessage: 'Not found' });
    }

    const method = getMethod(event).toUpperCase();
    if (!allowedMethods.has(method)) {
        throw createError({ statusCode: 405, statusMessage: 'Method not allowed' });
    }

    const requestUrl = getRequestURL(event);
    const target = `${OR3_LOCAL_SERVICE_ORIGIN}/${rawPath}${requestUrl.search}`;
    const incomingHeaders = getHeaders(event);
    if (!publicProxyRoute(rawPath, method) && !hasProxyAuth(incomingHeaders)) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Paired device token required for this proxy route.',
        });
    }

    const headers = new Headers();
    for (const name of forwardedHeaders) {
        const value = incomingHeaders[name];
        if (value) headers.set(name, value);
    }

    let body: BodyInit | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
        const rawBody = await readRawBody(event);
        body = rawBody as BodyInit | undefined;
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
        'content-disposition',
        'content-length',
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
