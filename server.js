/* Tiny static server for the portfolio — supports Range requests for the promo video. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 4173;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  /* dev helper: page can POST a dataURL screenshot here; saved for inspection */
  if (req.method === "POST" && urlPath === "/__shot") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      try {
        const b64 = body.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(path.join(ROOT, "__shot.jpg"), Buffer.from(b64, "base64"));
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("saved");
      } catch (e) {
        res.writeHead(500); res.end(String(e));
      }
    });
    return;
  }
  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^([.][.][/\\])+/, ""));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const range = req.headers.range;

    if (range && ext === ".mp4") {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (start >= stat.size) { res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }); return res.end(); }
      end = Math.min(end, stat.size - 1);
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": type
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes" });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}).listen(PORT, () => console.log(`Portfolio running at http://localhost:${PORT}`));
