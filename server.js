/**
 * Zero-dependency local dev server.
 *
 * `npx serve .` (the old "dev" script) only serves static files — it can never
 * invoke the files in /api because those are written as Vercel serverless
 * function exports (`module.exports = (req, res) => {...}`). This server
 * serves the same static files AND dispatches /api/* requests to those exact
 * handler modules, shimming `req.body` / `req.query` the way Vercel's Node
 * runtime does, so the real backend is testable locally with `npm run dev`.
 *
 * In production (Vercel), this file is never used — Vercel discovers /api/*.js
 * on its own and this static-serving logic is replaced by its edge network.
 */
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

const root = __dirname;

// Vercel injects configured env vars automatically in production; locally we
// need to read .env ourselves since there's no dotenv dependency in this
// project. Existing values (e.g. already-exported shell vars) win.
function loadDotEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}
loadDotEnv();

const PORT = process.env.PORT || 3000;

const API_ROUTES = {
  "/api/config": "./api/config.js",
  "/api/owner-auth": "./api/owner-auth.js",
  "/api/properties": "./api/properties.js",
  "/api/enquiries": "./api/enquiries.js"
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function addVercelResponseShim(res) {
  // The handlers in /api are written against Vercel's Node runtime, which
  // augments the plain http.ServerResponse with .status()/.json() helpers.
  // Node's built-in http module doesn't have these, so add them here.
  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function json(body) {
    if (!this.getHeader("Content-Type")) {
      this.setHeader("Content-Type", "application/json");
    }
    this.end(JSON.stringify(body));
    return this;
  };
  return res;
}

async function handleApi(req, res, modulePath) {
  addVercelResponseShim(res);
  const parsed = url.parse(req.url, true);
  req.query = parsed.query;

  const raw = await readBody(req).catch(() => "");
  const contentType = req.headers["content-type"] || "";
  if (raw && contentType.includes("application/json")) {
    try {
      req.body = JSON.parse(raw);
    } catch {
      req.body = raw;
    }
  } else {
    req.body = raw || undefined;
  }

  delete require.cache[require.resolve(modulePath)];
  const handler = require(modulePath);
  try {
    await handler(req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: error.message || "Internal error" }));
    }
  }
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = decodeURIComponent(filePath.split("?")[0]);
  const resolved = path.normalize(path.join(root, filePath));

  if (!resolved.startsWith(root)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }

  fs.readFile(resolved, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (API_ROUTES[pathname]) {
    const modulePath = API_ROUTES[pathname];
    if (!fs.existsSync(path.join(root, modulePath))) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: false, error: "Not implemented" }));
    }
    handleApi(req, res, modulePath);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`StayNest dev server running at http://localhost:${PORT}`);
  console.log(`API routes: ${Object.keys(API_ROUTES).join(", ")}`);
});
