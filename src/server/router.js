/**
 * Lightweight Native HTTP Router
 * Supports REST routes, path parameters (:id), JSON request parsing, and middleware.
 */

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const paramNames = [];
    const regexPattern = pattern
      .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      })
      .replace(/\//g, '\\/');

    const regex = new RegExp(`^${regexPattern}$`);
    this.routes.push({ method: method.toUpperCase(), regex, paramNames, handler });
  }

  get(pattern, handler) { this.add('GET', pattern, handler); }
  post(pattern, handler) { this.add('POST', pattern, handler); }
  put(pattern, handler) { this.add('PUT', pattern, handler); }
  delete(pattern, handler) { this.add('DELETE', pattern, handler); }

  async match(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token, X-Payment-Signature',
      });
      res.end();
      return true;
    }

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.regex);
      if (match) {
        req.params = {};
        for (let i = 0; i < route.paramNames.length; i++) {
          req.params[route.paramNames[i]] = decodeURIComponent(match[i + 1]);
        }
        req.query = Object.fromEntries(parsedUrl.searchParams.entries());

        await route.handler(req, res);
        return true;
      }
    }

    return false;
  }
}

/**
 * Helper to parse JSON body from incoming stream
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) { // 2MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Malformed JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Helper to send JSON responses
 */
function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

module.exports = {
  Router,
  parseJsonBody,
  sendJson,
};
