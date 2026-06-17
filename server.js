/**
 * server.js — VisioCirkit local dev server + LaTeX proxy
 *
 * Serves static files and proxies POST /api/latex → quicklatex.com
 *
 * Usage:  node server.js
 * Then open: http://localhost:3001
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = process.env.PORT || 3001;
const ROOT = __dirname;

const TEMPLATES_DIR = path.join(ROOT, 'template');
const WORKS_DIR = path.join(ROOT, 'work');

// Ensure directories exist
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}
if (!fs.existsSync(WORKS_DIR)) {
  fs.mkdirSync(WORKS_DIR, { recursive: true });
}

// Write default templates (excluding empty.tex) if directory is empty
const defaultTemplates = {
  'rc-lowpass.tex': `\\begin{circuitikz}[american]
  \\draw (0,0) to[sinusoidal voltage source, l=$V_s$] (0,3);
  \\draw (0,3) to[R, l=$R_1$] (4,3);
  \\draw (4,3) to[C, l=$C_1$] (4,0);
  \\draw (4,0) -- (0,0);
\\end{circuitikz}`,

  'bridge-rectifier.tex': `\\begin{circuitikz}[american]
  \\draw (0,0) to[sinusoidal voltage source, l=$V_s$] (0,4);
  \\draw (0,4) -- (2,4);
  \\draw (0,0) -- (2,0);
  \\draw (2,4) to[D, l=$D_1$] (4,2);
  \\draw (2,0) to[D, l=$D_2$] (4,2);
  \\draw (4,2) to[R, l=$R_L$] (4,-1);
  \\draw (4,-1) -- (2,-1);
  \\draw (2,-1) to[D, l=$D_3$] (2,0);
  \\draw (2,0) to[D, l=$D_4$] (0,0);
\\end{circuitikz}`,

  'opamp-amp.tex': `\\begin{circuitikz}[american]
  \\draw (0,3) to[sinusoidal voltage source, l=$V_{in}$] (0,0);
  \\draw (0,0) node[ground] {};
  \\draw (5,2.5) node[op amp] (OA) {};
  \\draw (0,3) to[R, l=$R_1$] (OA.-);
  \\draw (OA.+) -- (4,2) node[ground] {};
  \\draw (OA.-) -- (3.75,4.5) to[R, l=$R_f$] (6.25,4.5) -- (OA.out);
  \\draw (OA.out) to[short, *-o] (7.5,2.5) node[right] {$V_{out}$};
\\end{circuitikz}`,

  'sallen-key.tex': `\\begin{circuitikz}[american]
  \\draw (0,0) node[op amp] (opamp) {};
  \\draw (opamp.-) -- (-1.5, 0.5) -- (-1.5, 2) -- (1.5, 2) -- (opamp.out);
  \\draw (opamp.+) -- (-1.5, -0.5) to[C, l=$C_1$] (-1.5, -2) node[ground]{};
  \\draw (-4.5, -0.5) to[R, l=$R_1$] (-3, -0.5) to[R, l=$R_2$] (-1.5, -0.5);
  \\draw (-3, -0.5) to[C, l=$C_2$] (-3, 2) -- (-1.5, 2);
  \\draw (-4.5, -0.5) to[short, -o] (-5, -0.5) node[left] {$V_{in}$};
  \\draw (opamp.out) to[short, -o] (2.5, 0) node[right] {$V_{out}$};
\\end{circuitikz}`,

  'user-complex.tex': `\\begin{circuitikz}[american]
    % Input square wave shape
    \\draw ( -2.2,  4.0) to[short] ( -1.8,  4.0);
    \\draw ( -1.8,  4.0) to[short] ( -1.8,  3.2);
    \\draw ( -1.8,  3.2) to[short] ( -1.2,  3.2);
    \\draw ( -1.2,  3.2) to[short] ( -1.2,  4.0);
    \\draw ( -1.2,  4.0) to[short] ( -0.8,  4.0);

    % Input port and label
    \\draw ( -0.5,  3.5) node[left] {$V_{\\mathrm{PWM, P(N)}}$};
    \\draw ( -0.5,  3.5) to[short, -o] (  0.2,  3.5);
    \\draw (  0.2,  3.5) to[short] (  1.5,  3.5);

    % Vertical input distribution bus
    \\draw (  1.5,  7.5) to[short] (  1.5, -0.5);

    % M1 (PMOS) centered at (3.75, 7.0)
    \\draw (  3.75, 7.0) node[pmos, emptycircle] {};
    \\draw (  1.5,  7.0) to[short] (  3.0,  7.0); % Gate connection
    \\draw (  3.75, 7.75) to[short] (  3.75, 8.0); % Source connection
    \\draw (  3.75, 8.0) node[vcc] {$V_{\\mathrm{DD}}$};
    \\draw (  3.75, 6.25) to[short] (  3.75, 5.75); % Drain to M2 Source

    % M2 (PMOS) centered at (3.75, 5.0)
    \\draw (  3.75, 5.0) node[pmos, emptycircle] {};
    \\draw (  1.5,  5.0) to[short] (  3.0,  5.0); % Gate connection

    % M3 (NMOS) centered at (3.75, 3.0)
    \\draw (  3.75, 3.0) node[nmos] {};
    \\draw (  1.5,  3.0) to[short] (  3.0,  3.0); % Gate connection
    \\draw (  3.75, 4.25) to[short] (  3.75, 3.75); % M2 Drain to M3 Drain

    % Node V_X (Top Stack Output) at (3.75, 4.0)
    \\draw (  3.75, 4.0) to[short, *-o] (  5.25, 4.0);
    \\draw (  5.25, 4.0) node[right] {$V_X$};

    % M4 (PMOS) centered at (3.75, 1.0)
    \\draw (  3.75, 1.0) node[pmos, emptycircle] {};
    \\draw (  1.5,  1.0) to[short] (  3.0,  1.0); % Gate connection
    \\draw (  3.75, 2.25) to[short] (  3.75, 1.75); % M3 Source to M4 Source

    % M5 (NMOS) centered at (3.75, -1.0)
    \\draw (  3.75,-1.0) node[nmos] {};
    \\draw (  1.5, -1.0) to[short] (  3.0, -1.0); % Gate connection
    \\draw (  3.75, 0.25) to[short] (  3.75,-0.25); % M4 Drain to M5 Drain

    % M6 (NMOS) centered at (3.75, -3.0)
    \\draw (  3.75,-3.0) node[nmos] {};
    \\draw (  1.5, -3.0) to[short] (  3.0, -3.0); % Gate connection
    \\draw (  3.75,-1.75) to[short] (  3.75,-2.25); % M5 Source to M6 Drain
    \\draw (  3.75,-3.75) to[short] (  3.75,-4.0); % M6 Source connection
    \\draw (  3.75,-4.0) node[ground] {};

    % Node V_Y (Bottom Stack Output) at (3.75, 0.0)
    \\draw (  3.75, 0.0) to[short, *-o] (  5.25, 0.0);
    \\draw (  5.25, 0.0) node[right] {$V_Y$};

    % Connect V_X to Pull-up Driver (MP)
    \\draw (  5.25, 4.0) to[short] (  6.25, 4.0);
    \\draw (  6.25, 4.0) to[short] (  6.25, 3.5); % Wire to MP Gate
    \\draw (  6.25, 3.5) to[short] (  7.0,  3.5); % Wire to MP Gate
    
    % MP (PMOS) centered at (7.75, 3.5)
    \\draw (  7.75, 3.5) node[pmos, emptycircle] {};
    \\draw (  7.75, 4.25) to[short] (  7.75, 8.0); % MP Source to VDD
    \\draw (  7.75, 8.0) node[vcc] {$V_{\\mathrm{DD}}$};

    % Connect V_Y to Pull-down Driver (MN)
    \\draw (  5.25, 0.0) to[short] (  6.25, 0.0);
    \\draw (  6.25, 0.0) to[short] (  6.25, 0.5); % Wire to MN Gate
    \\draw (  6.25, 0.5) to[short] (  7.0,  0.5); % Wire to MN Gate

    % MN (NMOS) centered at (7.75, 0.5)
    \\draw (  7.75, 0.5) node[nmos] {};
    \\draw (  7.75,-0.25) to[short] (  7.75,-4.0); % MN Source to Ground
    \\draw (  7.75,-4.0) node[ground] {};

    % Connect MP Drain and MN Drain to V_SW
    \\draw (  7.75, 2.75) to[short] (  7.75, 2.0); % MP Drain down
    \\draw (  7.75, 1.25) to[short] (  7.75, 2.0); % MN Drain up
    \\draw (  7.75, 2.0) to[short, *-] (  9.25, 2.0); % V_SW to L_in
    
    % Inductor L_F
    \\draw (  9.25, 2.0) to[L=$L_F$] ( 11.75, 2.0);
    
    % Capacitor C_F and Load R_L
    \\draw ( 11.75, 2.0) to[short, *-] ( 11.75, 0.5);
    \\draw ( 11.75, 0.5) to[C=$C_F$] ( 11.75,-1.5);
    \\draw ( 11.75,-1.5) node[ground] {};
    
    \\draw ( 11.75, 2.0) to[short] ( 13.75, 2.0);
    \\draw ( 13.75, 2.0) to[R=$R_L$] ( 13.75,-1.5);
    \\draw ( 13.75,-1.5) node[ground] {};
    
    % Output Signal Label
    \\draw ( 13.75, 2.0) to[short, *-o] ( 16.75, 2.0);
    \\draw ( 16.75, 2.0) node[right] {$V_{\\mathrm{out}}$};
\\end{circuitikz}`
};

if (fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.tex')).length === 0) {
  for (const [name, content] of Object.entries(defaultTemplates)) {
    fs.writeFileSync(path.join(TEMPLATES_DIR, name), content, 'utf8');
  }
}

// ---------- MIME types ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// ---------- Static file handler ----------
function serveStatic(req, res) {
  const { pathname } = url.parse(req.url);
  // Check if target file exists in dist/ folder first
  const isDistFile = fs.existsSync(path.join(ROOT, 'dist', pathname === '/' ? 'index.html' : pathname));
  const baseDir = isDistFile ? path.join(ROOT, 'dist') : ROOT;
  let filePath = path.join(baseDir, pathname === '/' ? 'index.html' : pathname);

  // Prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + req.url);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ---------- QuickLaTeX proxy ----------
function proxyLatex(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const options = {
      hostname: 'quicklatex.com',
      path:     '/latex3.f',
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent':     'VisioCirkit-Proxy/1.0',
        'Referer':        'https://quicklatex.com/',
      },
    };

    const proxyReq = https.request(options, proxyRes => {
      let data = '';
      proxyRes.on('data', chunk => { data += chunk; });
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type':                'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      });
    });

    proxyReq.on('error', err => {
      console.error('[proxy] QuickLaTeX error:', err.message);
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Proxy error: ' + err.message);
    });

    proxyReq.write(body);
    proxyReq.end();
  });
}

// ---------- Main server ----------
const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (pathname === '/api/latex' && req.method === 'POST') {
    proxyLatex(req, res);
  } else if (pathname === '/api/files' && req.method === 'GET') {
    try {
      const templates = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.tex'));
      const works = fs.readdirSync(WORKS_DIR).filter(f => f.endsWith('.tex'));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ templates, works }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (pathname === '/api/file' && req.method === 'GET') {
    const query = url.parse(req.url, true).query;
    const { dir, name } = query;
    if (!dir || !name) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing dir or name parameter');
      return;
    }
    const safeName = path.basename(name);
    const targetDir = dir === 'template' ? TEMPLATES_DIR : WORKS_DIR;
    const filePath = path.join(targetDir, safeName);
    
    if (!filePath.startsWith(targetDir)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    });
  } else if (pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { dir, name, content } = payload;
        if (!dir || !name || content === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing dir, name, or content' }));
          return;
        }

        const safeName = path.basename(name);
        const targetDir = dir === 'template' ? TEMPLATES_DIR : WORKS_DIR;
        const filePath = path.join(targetDir, safeName);

        if (!filePath.startsWith(targetDir)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }

        if (dir === 'template' && fs.existsSync(filePath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Template files are read-only and cannot be modified.' }));
          return;
        }

        fs.writeFile(filePath, content, 'utf8', (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true }));
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
  } else if (pathname === '/api/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { dir, name } = payload;
        if (!dir || !name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing dir or name' }));
          return;
        }

        const safeName = path.basename(name);
        if (dir !== 'work') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Only files in work/ directory can be deleted.' }));
          return;
        }

        const filePath = path.join(WORKS_DIR, safeName);
        if (!filePath.startsWith(WORKS_DIR)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }

        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: true }));
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`\n  ⚡ VisioCirkit running at http://localhost:${PORT}\n`);
});
