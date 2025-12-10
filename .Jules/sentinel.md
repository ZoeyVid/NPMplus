## 2024-05-23 - [Stack Trace Exposure]
**Schwachstelle:** Stack Trace Exposure in backend/app.js.
**Erkenntnis:** The application explicitly sets `payload.debug.stack` when the request path contains "nginx/certificates". This leaks internal file paths and architectural details to the client.
**Prävention:** Remove the conditional block that adds stack traces to the response payload. Use server-side logs for debugging instead.
