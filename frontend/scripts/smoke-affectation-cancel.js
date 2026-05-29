const {
  API_URL,
  FRONTEND_URL,
  authenticate,
  createApiContext,
  ensureServiceReady,
  launchBrowser
} = require('./smoke-common');

const MANAGER_CREDENTIALS = { email: 'manager@smartassign.tn', motDePasse: 'manager123' };

async function loginManager(api) {
  return authenticate(api, MANAGER_CREDENTIALS);
}

async function fetchAffectations(api, token) {
  const response = await api.get(`${API_URL}/affectations`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok()) {
    throw new Error(`Fetching affectations failed: ${response.status()}`);
  }

  return response.json();
}

async function restoreProjectAffectations(api, token, projectId) {
  const response = await api.post(`${API_URL}/affectations/lancer/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {}
  });

  if (!response.ok()) {
    throw new Error(`Restoring affectations failed for project ${projectId}: ${response.status()}`);
  }

  return response.json();
}

async function openManagerAffectationsPage(browser, managerUser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('dialog', (dialog) => dialog.accept());

  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await page.evaluate((user) => {
    localStorage.setItem('smartassign_user', JSON.stringify(user));
    localStorage.setItem('token', user.token);
  }, managerUser);

  const affectationsResponse = page.waitForResponse(
    (response) => response.url().includes('/api/affectations') && response.request().method() === 'GET' && response.status() === 200
  );

  await page.goto(`${FRONTEND_URL}/manager/affectations-en-cours`, { waitUntil: 'networkidle' });
  await affectationsResponse;

  return { context, page };
}

async function findTargetRow(page, affectation) {
  const row = page.locator('article.row').filter({
    hasText: `${affectation.collaborateur.prenom} ${affectation.collaborateur.nom}`
  }).filter({
    hasText: affectation.projet.nom
  }).first();

  await row.waitFor({ state: 'visible', timeout: 15000 });
  return row;
}

async function main() {
  await ensureServiceReady(FRONTEND_URL, 90000);
  await ensureServiceReady(`${API_URL}/affectations`, 90000);

  const browser = await launchBrowser();
  const api = await createApiContext();

  try {
    const managerUser = await loginManager(api);
    const initialAffectations = await fetchAffectations(api, managerUser.token);
    const target = initialAffectations.find((affectation) => affectation.projet?.statut !== 'termine');

    if (!target) {
      throw new Error('No active affectation available for validation.');
    }

    const deleteSession = await openManagerAffectationsPage(browser, managerUser);
    const deletePage = deleteSession.page;
    const rowsBeforeDelete = await deletePage.locator('article.row').count();
    const targetRow = await findTargetRow(deletePage, target);
    const deleteResponsePromise = deletePage.waitForResponse(
      (response) => response.url().endsWith(`/api/affectations/${target.id}`) && response.status() === 204
    );

    await targetRow.getByRole('button', { name: 'Annuler' }).click();
    await deleteResponsePromise;
    await targetRow.waitFor({ state: 'detached', timeout: 15000 });

    const rowsAfterDelete = await deletePage.locator('article.row').count();
    await deleteSession.context.close();

    const afterDeleteAffectations = await fetchAffectations(api, managerUser.token);
    const stillExistsAfterDelete = afterDeleteAffectations.some((affectation) => affectation.id === target.id);

    const restored = await restoreProjectAffectations(api, managerUser.token, target.projet.id);
    const restoredTarget = restored.find((affectation) => affectation.collaborateur.id === target.collaborateur.id);

    if (!restoredTarget) {
      throw new Error('Deleted affectation could not be restored after success-path validation.');
    }

    const rollbackSession = await openManagerAffectationsPage(browser, managerUser);
    const rollbackPage = rollbackSession.page;
    const rollbackRow = await findTargetRow(rollbackPage, { ...target, id: restoredTarget.id });
    const rowsBeforeRollback = await rollbackPage.locator('article.row').count();

    await rollbackPage.route(`**/api/affectations/${restoredTarget.id}`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Erreur simulée' })
      });
    });

    await rollbackRow.getByRole('button', { name: 'Annuler' }).click();
    await rollbackPage.waitForSelector('.state-card--error', { timeout: 15000 });

    const rowsAfterRollback = await rollbackPage.locator('article.row').count();
    const rollbackError = await rollbackPage.locator('.state-card--error').innerText();
    const rollbackButtonDisabled = await rollbackRow.getByRole('button', { name: 'Annuler' }).isDisabled();

    await rollbackSession.context.close();

    console.log(JSON.stringify({
      success: {
        deletedId: target.id,
        projectId: target.projet.id,
        rowsBeforeDelete,
        rowsAfterDelete,
        backendDeleted: !stillExistsAfterDelete,
        restoredId: restoredTarget.id
      },
      rollback: {
        targetId: restoredTarget.id,
        rowsBeforeRollback,
        rowsAfterRollback,
        errorMessage: rollbackError.trim(),
        buttonReenabled: !rollbackButtonDisabled
      }
    }, null, 2));
  } finally {
    await api.dispose();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});