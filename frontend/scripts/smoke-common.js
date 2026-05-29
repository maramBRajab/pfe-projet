const { chromium, request } = require('playwright');

const FRONTEND_URL = process.env.SMOKE_FRONTEND_URL || 'http://localhost:4200';
const API_URL = process.env.SMOKE_API_URL || 'http://localhost:8082/api';
const EDGE_PATH = process.env.SMOKE_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function launchBrowser() {
  return chromium.launch({ headless: true, executablePath: EDGE_PATH });
}

async function createApiContext() {
  return request.newContext();
}

async function ensureServiceReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 401 || response.status === 403) {
        return;
      }
    } catch {
      // Retry until the deadline is reached.
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(`Service did not become ready: ${url}`);
}

async function authenticate(apiContext, credentials) {
  const response = await apiContext.post(`${API_URL}/auth/login`, { data: credentials });
  if (!response.ok()) {
    throw new Error(`Login failed for ${credentials.email}: ${response.status()}`);
  }

  return response.json();
}

function normalizePathname(url) {
  return new URL(url).pathname.replace(/\/+$/, '') || '/';
}

function captureApiResponses(page) {
  const apiResponses = [];

  page.on('response', (response) => {
    const url = response.url();
    if (url.startsWith(`${API_URL}/`)) {
      apiResponses.push({ url, status: response.status() });
    }
  });

  return apiResponses;
}

function consumeApiResponses(apiResponses) {
  return apiResponses.splice(0, apiResponses.length);
}

async function openAuthenticatedPage(browser, authUser, path, waitUntil = 'networkidle') {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await page.evaluate((user) => {
    localStorage.setItem('smartassign_user', JSON.stringify(user));
    localStorage.setItem('token', user.token);
  }, authUser);

  await page.goto(`${FRONTEND_URL}${path}`, { waitUntil });

  return { context, page };
}

module.exports = {
  API_URL,
  EDGE_PATH,
  FRONTEND_URL,
  authenticate,
  captureApiResponses,
  consumeApiResponses,
  createApiContext,
  ensureServiceReady,
  launchBrowser,
  normalizePathname,
  openAuthenticatedPage
};