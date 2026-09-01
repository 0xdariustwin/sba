'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { mkdir, readFile } = require('node:fs/promises');
const path = require('node:path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const OUTPUT_ROOT = path.join(ROOT, 'output');
const MAX_BODY_BYTES = 16 * 1024;
const jobs = new Map();

function parseVideoUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('A valid YouTube URL is required.');
  let url;
  try { url = new URL(value); } catch { throw new Error('A valid YouTube URL is required.'); }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host) || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only youtube.com and youtu.be URLs are accepted.');
  }
  return url.toString();
}

function normalizeTerms(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.length > 500) throw new Error('Search terms must be 500 characters or fewer.');
  return value.replace(/[\r\n\0]/g, ' ').trim();
}

function parseInterval(value) {
  const interval = Number(value ?? 5);
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) throw new Error('Interval must be an integer from 1 to 60.');
  return interval;
}

function publicJob(job) {
  return { id: job.id, status: job.status, createdAt: job.createdAt, finishedAt: job.finishedAt, exitCode: job.exitCode, log: job.log };
}

function startJob({ url, terms, interval }) {
  const id = randomUUID();
  const job = { id, status: 'queued', createdAt: new Date().toISOString(), finishedAt: null, exitCode: null, log: '' };
  jobs.set(id, job);
  const output = path.join(OUTPUT_ROOT, id);
  const child = spawn('bash', [path.join(ROOT, 'scripts/process-video.sh'), url, output, terms, String(interval)], {
    cwd: ROOT,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false
  });
  job.status = 'running';
  const append = chunk => { job.log = (job.log + chunk.toString()).slice(-40_000); };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', error => { append(`\nUnable to start job: ${error.message}\n`); });
  child.on('close', code => {
    job.exitCode = code;
    job.status = code === 0 ? 'completed' : 'failed';
    job.finishedAt = new Date().toISOString();
  });
  return job;
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('Request body is too large.');
  }
  try { return JSON.parse(body); } catch { throw new Error('Request body must be valid JSON.'); }
}

function authorized(request) {
  const token = process.env.APP_TOKEN;
  return !token || request.headers.authorization === `Bearer ${token}`;
}

async function handler(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && requestUrl.pathname === '/') {
    const html = await readFile(path.join(ROOT, 'public/index.html'));
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" });
    return response.end(html);
  }
  if (request.method === 'GET' && requestUrl.pathname === '/app.js') {
    const script = await readFile(path.join(ROOT, 'public/app.js'));
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    return response.end(script);
  }
  if (requestUrl.pathname.startsWith('/api/') && !authorized(request)) {
    return sendJson(response, 401, { error: 'Unauthorized' });
  }
  if (request.method === 'POST' && requestUrl.pathname === '/api/jobs') {
    try {
      const body = await readJson(request);
      const job = startJob({ url: parseVideoUrl(body.url), terms: normalizeTerms(body.terms), interval: parseInterval(body.interval) });
      return sendJson(response, 202, publicJob(job));
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }
  const match = requestUrl.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)$/);
  if (request.method === 'GET' && match) {
    const job = jobs.get(match[1]);
    return job ? sendJson(response, 200, publicJob(job)) : sendJson(response, 404, { error: 'Job not found.' });
  }
  sendJson(response, 404, { error: 'Not found.' });
}

if (require.main === module) {
  mkdir(OUTPUT_ROOT, { recursive: true }).then(() => {
    http.createServer((request, response) => handler(request, response).catch(error => sendJson(response, 500, { error: error.message })))
      .listen(PORT, HOST, () => console.log(`Video job server listening on http://${HOST}:${PORT}`));
  });
}

module.exports = { handler, normalizeTerms, parseInterval, parseVideoUrl };
