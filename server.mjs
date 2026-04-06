import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const host = "127.0.0.1";
const port = 4174;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
};

const send = (res, status, body, type = "text/plain; charset=utf-8") => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
};

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${host}:${port}`).pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const candidate = normalize(join(root, requested));

  if (!candidate.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  if (!existsSync(candidate)) {
    send(res, 404, "Not found");
    return;
  }

  const stats = statSync(candidate);
  if (stats.isDirectory()) {
    send(res, 403, "Directory listing disabled");
    return;
  }

  const type = mimeTypes[extname(candidate).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  createReadStream(candidate).pipe(res);
}).listen(port, host, () => {
  console.log(`Dice spike server running at http://${host}:${port}/`);
});
