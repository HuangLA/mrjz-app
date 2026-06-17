import http from "node:http";
import https from "node:https";

const listenHost = process.env.MRJZ_MINIPROGRAM_PROXY_HOST || "127.0.0.1";
const listenPort = Number(process.env.MRJZ_MINIPROGRAM_PROXY_PORT || 8787);
const upstream = new URL(process.env.MRJZ_MINIPROGRAM_PROXY_UPSTREAM || "https://api.dota2mrjz.icu");

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const server = http.createServer((request, response) => {
  const headers = { ...request.headers };
  for (const header of hopByHopHeaders) {
    delete headers[header];
  }

  headers.host = upstream.host;

  const proxyRequest = https.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || 443,
      method: request.method,
      path: request.url || "/",
      headers,
      minVersion: "TLSv1.3",
      servername: upstream.hostname,
    },
    (proxyResponse) => {
      const responseHeaders = { ...proxyResponse.headers };
      for (const header of hopByHopHeaders) {
        delete responseHeaders[header];
      }

      response.writeHead(proxyResponse.statusCode || 502, responseHeaders);
      proxyResponse.pipe(response);
    },
  );

  proxyRequest.on("error", (error) => {
    response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ success: false, error: { code: "PROXY_ERROR", message: error.message } }));
  });

  request.pipe(proxyRequest);
});

server.listen(listenPort, listenHost, () => {
  console.log(`MRJZ mini-program API proxy listening on http://${listenHost}:${listenPort}`);
  console.log(`Forwarding requests to ${upstream.origin}`);
});
