const { APIRequestContext, expect } = require('@playwright/test');

const API_URL = process.env.SMOKE_API_URL || 'http://localhost:8082/api';

/**
 * @param {APIRequestContext} request
 * @param {{ email: string, motDePasse: string }} credentials
 */
async function loginViaApi(request, credentials) {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: credentials
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {any} user
 */
async function seedSession(page, user) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate((sessionUser) => {
    localStorage.setItem('smartassign_user', JSON.stringify(sessionUser));
    localStorage.setItem('token', sessionUser.token);
  }, user);
}

module.exports = {
  API_URL,
  loginViaApi,
  seedSession
};