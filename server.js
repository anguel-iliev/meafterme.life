// server.js — Next.js custom server for SuperHosting cPanel Node.js App Manager
// This is the startup file to set in cPanel: "Application startup file: server.js"

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev  = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, host, (err) => {
    if (err) throw err;
    console.log(`> MEafterMe ready on http://${host}:${port}`);
    console.log(`> NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`> APP_URL: ${process.env.APP_URL || 'https://afterme.life'}`);
  });
});
