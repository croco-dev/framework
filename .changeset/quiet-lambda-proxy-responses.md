---
"@croco/meta-vite": patch
"@croco/transports-http": patch
---

Preserve buffered Lambda response status, headers, cookies and body through API Gateway v1/v2 serialization. Meta-vite Lambda callbacks now return LambdaProxyResponse instead of Web Response: use statusCode and body, decoding base64 when isBase64Encoded is true. Reuse the HTTP transport response converter through @croco/transports-http/lambda-response; body read failures reject the invocation.
