const { test, expect } = require('@playwright/test');
const { API_URL, loginViaApi, seedSession } = require('./helpers/auth');

const MANAGER_CREDENTIALS = { email: 'manager@smartassign.tn', motDePasse: 'manager123' };

async function fetchAffectations(request, token) {
  const response = await request.get(`${API_URL}/affectations`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function restoreProjectAffectations(request, token, projectId) {
  const response = await request.post(`${API_URL}/affectations/lancer/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {}
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function openAffectationsPage(page, managerUser) {
  await seedSession(page, managerUser);
  await page.goto('/manager/affectations-en-cours', { waitUntil: 'networkidle' });
}

async function findTargetRow(page, affectation) {
  const row = page.locator('article.row').filter({
    hasText: `${affectation.collaborateur.prenom} ${affectation.collaborateur.nom}`
  }).filter({
    hasText: affectation.projet.nom
  }).first();

  await expect(row).toBeVisible();
  return row;
}

test.describe('Manager affectation cancellation', () => {
  test('supports real delete and UI rollback on failure', async ({ page, request }) => {
    const managerUser = await loginViaApi(request, MANAGER_CREDENTIALS);
    const initialAffectations = await fetchAffectations(request, managerUser.token);
    const target = initialAffectations.find((affectation) => affectation.projet?.statut !== 'termine');

    expect(target).toBeTruthy();

    await openAffectationsPage(page, managerUser);
    const rowsBeforeDelete = await page.locator('article.row').count();
    const targetRow = await findTargetRow(page, target);
    const deleteResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith(`/api/affectations/${target.id}`) && response.status() === 204
    );

    page.once('dialog', (dialog) => dialog.accept());
    await targetRow.getByRole('button', { name: 'Annuler' }).click();
    await deleteResponsePromise;
    await expect(targetRow).toBeHidden();

    const rowsAfterDelete = await page.locator('article.row').count();
    expect(rowsAfterDelete).toBeLessThan(rowsBeforeDelete);

    const afterDeleteAffectations = await fetchAffectations(request, managerUser.token);
    expect(afterDeleteAffectations.some((affectation) => affectation.id === target.id)).toBeFalsy();

    const restored = await restoreProjectAffectations(request, managerUser.token, target.projet.id);
    const restoredTarget = restored.find((affectation) => affectation.collaborateur.id === target.collaborateur.id);
    expect(restoredTarget).toBeTruthy();

    await openAffectationsPage(page, managerUser);
    const rollbackRow = await findTargetRow(page, { ...target, id: restoredTarget.id });
    const rowsBeforeRollback = await page.locator('article.row').count();

    await page.route(`**/api/affectations/${restoredTarget.id}`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Erreur simulée' })
      });
    });

    page.once('dialog', (dialog) => dialog.accept());
    await rollbackRow.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.locator('.state-card--error')).toContainText(`Impossible d'annuler cette affectation.`);
    expect(await page.locator('article.row').count()).toBe(rowsBeforeRollback);
    await expect(rollbackRow.getByRole('button', { name: 'Annuler' })).toBeEnabled();
  });
});