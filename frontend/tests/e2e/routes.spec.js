const { test, expect } = require('@playwright/test');
const { loginViaApi, seedSession } = require('./helpers/auth');
const { cleanupPublicTestUsers } = require('./helpers/cleanup');
const { createPublicTestUser, fillInputByPlaceholder } = require('./helpers/public-flow');

const smokeCredentials = (role) => ({
  email: process.env[`SMOKE_${role}_EMAIL`],
  motDePasse: process.env[`SMOKE_${role}_PASSWORD`]
});

const ROLE_CONFIGS = [
  {
    name: 'admin',
    credentials: smokeCredentials('ADMIN'),
    routes: [
      '/admin/dashboard',
      '/admin/profil',
      '/admin/projets',
      '/admin/collaborateurs',
      '/admin/affectation'
    ]
  },
  {
    name: 'manager',
    credentials: smokeCredentials('MANAGER'),
    routes: [
      '/manager/dashboard',
      '/manager/projets/mes-projets',
      '/manager/projets',
      '/manager/collaborateurs',
      '/manager/affectation',
      '/manager/affectations-en-cours',
      '/manager/charge-travail',
      '/manager/historique-affectations'
    ]
  },
  {
    name: 'collaborateur',
    credentials: smokeCredentials('COLLAB'),
    routes: [
      '/dashboard',
      '/mes-projets',
      '/planning',
      '/mon-profil',
      '/historique'
    ]
  }
];

test.describe('Route smoke suite', () => {
  test.beforeEach(async ({ request }) => {
    await cleanupPublicTestUsers(request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupPublicTestUsers(request);
  });

  test('public signup and login flow works', async ({ page, request }) => {
    const signupUser = createPublicTestUser();

    await page.goto('/');
    await expect(page.getByRole('link', { name: /S'inscrire/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Se connecter/i })).toBeVisible();

    await page.getByRole('link', { name: /S'inscrire/i }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText('SMARTASSIGN')).toBeVisible();

    await fillInputByPlaceholder(page, 'Nom', signupUser.nom);
    await fillInputByPlaceholder(page, 'Prénom', signupUser.prenom);
    await fillInputByPlaceholder(page, 'Email', signupUser.email);
    await fillInputByPlaceholder(page, 'Mot de passe', signupUser.motDePasse);
    await fillInputByPlaceholder(page, 'Confirmer le mot de passe', signupUser.motDePasse);
    await page.getByRole('button', { name: /Créer mon compte/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Bonjour, Public Smoke/i })).toBeVisible();

    await page.evaluate(() => {
      localStorage.removeItem('smartassign_user');
      localStorage.removeItem('token');
    });
    await page.goto('/login');
    await fillInputByPlaceholder(page, 'Email', signupUser.email);
    await fillInputByPlaceholder(page, 'Mot de passe', signupUser.motDePasse);
    await page.getByRole('button', { name: /Se connecter/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Bonjour, Public Smoke/i })).toBeVisible();

    await cleanupPublicTestUsers(request, signupUser.email);
  });

  for (const roleConfig of ROLE_CONFIGS) {
    test(`${roleConfig.name} routes render without API failures`, async ({ page, request }) => {
      const user = await loginViaApi(request, roleConfig.credentials);
      await seedSession(page, user);

      for (const route of roleConfig.routes) {
        await page.goto(route, { waitUntil: 'networkidle' });
        await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
        await expect(page.locator('body')).not.toContainText('Impossible de charger');
      }
    });
  }
});
