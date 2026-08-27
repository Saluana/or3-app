# Shared `or3-intern` Client

`or3-app` keeps its existing `useOr3Api()` interface, host selection, PIN
gating, Electron service tokens, secure-session enrollment, auth-challenge
retry, and host-status updates. Its raw HTTP and SSE boundary is
`app/utils/or3/intern-compat.ts`, backed by the framework-free
`@or3/intern-client` package owned by `or3-intern`.

This adapter preserves existing callers while sharing:

- relative-path and credential-in-URL validation;
- abortable request and stream-connect timeouts;
- secret redaction;
- response/error transport;
- SSE parsing and cursor metadata.

Authentication is resolved by `useOr3Api` and passed as headers to the shared
transport. Tokens remain in the existing secure host-token and Electron
adapters; the shared package never persists them. Generic transport methods
remain available for app endpoints beyond the high-level runner/session API.

When the service contract changes, update the fixture in
`or3-intern/cmd/or3-intern/testdata/service_contract`, the shared client tests,
and `or3-app` compatibility tests together.
