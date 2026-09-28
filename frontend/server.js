import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const DIST = path.join(__dirname, 'dist');

const server = http.createServer((req, res) => {
  let file = path.join(DIST, req.url === '/' ? 'index.html' : req.url);

  fs.readFile(file, (err, data) => {
    if (err) {
      fs.readFile(path.join(DIST, 'index.html'), (err, data) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    } else {
      const ext = path.extname(file);
      const type = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'text/html';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Frontend rodando em http://0.0.0.0:${PORT}`);
});
