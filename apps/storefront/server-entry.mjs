/**
 * Standalone Node.js HTTP server for TanStack Start SSR.
 *
 * dist/server/server.js exports a Web-standard `fetch(Request) → Response`
 * handler. This file wraps it with a Node.js HTTP server so it can run
 * in production without Nitro's build step.
 */
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = join(__dirname, "dist", "client");

// Import the TanStack Start SSR handler
const app = await import("./dist/server/server.js");
const handler = app.default?.fetch ?? app.fetch;

if (typeof handler !== "function") {
  console.error("Could not find fetch handler in dist/server/server.js");
  process.exit(1);
}

// MIME types for static assets
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

/**
 * Try to serve a static file from dist/client/.
 * Returns true if served, false if not found.
 */
async function tryServeStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = resolve(join(clientDir, url.pathname));

  // Prevent path traversal — resolved path must be inside clientDir
  if (!filePath.startsWith(resolve(clientDir))) return false;

  try {
    const s = await stat(filePath);
    if (!s.isFile()) return false;
  } catch {
    return false;
  }

  const ext = filePath.substring(filePath.lastIndexOf("."));
  const contentType = MIME[ext] || "application/octet-stream";

  // Cache immutable hashed assets for 1 year
  const isHashed = url.pathname.startsWith("/assets/");
  const cacheControl = isHashed
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";

  const data = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": data.byteLength,
    "Cache-Control": cacheControl,
  });
  res.end(data);
  return true;
}

const server = createServer(async (req, res) => {
  try {
    // Lightweight health check — no SSR, no API calls.
    // Railway's healthcheck hits "/" with user-agent "RailwayHealthCheck/1.0".
    // Also handle explicit /healthz endpoint.
    const ua = req.headers["user-agent"] || "";
    if (req.url === "/healthz" || req.url === "/_health" || ua.includes("RailwayHealthCheck")) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
      return;
    }

    // Try static files first (client assets, SW, manifest, etc.)
    if (req.method === "GET") {
      const served = await tryServeStatic(req, res);
      if (served) return;
    }

    // Build a Web Request from the Node.js request
    const url = new URL(req.url, `http://${req.headers.host}`);
    console.log(`[SSR] ${req.method} ${url.pathname}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD"
        ? Readable.toWeb(req)
        : undefined,
      duplex: "half",
    });

    // Call the TanStack Start handler with a timeout
    const timeoutMs = 15000;
    const webResponse = await Promise.race([
      handler(webRequest),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`SSR timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    // Write the Web Response back to Node.js response with cache headers
    const responseHeaders = Object.fromEntries(webResponse.headers);
    // Cache HTML pages for 60s at CDN/proxy level, stale-while-revalidate for 5min
    if (!responseHeaders["cache-control"] && webResponse.status === 200) {
      responseHeaders["cache-control"] = "public, s-maxage=60, stale-while-revalidate=300";
    }
    res.writeHead(webResponse.status, responseHeaders);

    if (webResponse.body) {
      const reader = webResponse.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (err) {
    console.error("SSR Error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
    }
    res.end("Internal Server Error");
  }
});

const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

server.listen(port, host, () => {
  console.log(`Storefront SSR server listening on http://${host}:${port}`);
});
