const {
  API_URL,
  FRONTEND_URL,
  authenticate,
  captureApiResponses,
  consumeApiResponses,
  createApiContext,
  ensureServiceReady,
  launchBrowser,
  normalizePathname
} = require('./smoke-common');

const PUBLIC_FLOW_PASSWORD = 'SmartAssign2026';
const ADMIN_CREDENTIALS = { email: 'admin@smartassign.tn', motDePasse: 'admin123' };

const ROLE_CONFIGS = [
  {
    name: 'admin',
    credentials: { email: 'admin@smartassign.tn', motDePasse: 'admin123' },
    routes: [
      { path: '/admin/dashboard' },
      { path: '/admin/profil' },
      { path: '/admin/projets' },
      { path: '/admin/collaborateurs' },
      { path: '/admin/affectation' },
      { path: '/admin/affectations', expectedFinalPath: '/admin/affectation' }
    ]
  },
  {
    name: 'manager',
    credentials: { email: 'manager@smartassign.tn', motDePasse: 'manager123' },
    routes: [
      { path: '/manager/dashboard' },
      { path: '/manager/projets/mes-projets' },
      { path: '/manager/projets' },
      { path: '/manager/collaborateurs' },
      { path: '/manager/affectation' },
      { path: '/manager/affectations-en-cours' },
      { path: '/manager/charge-travail' },
      { path: '/manager/historique-affectations' },
      { path: '/manager/planning', expectedFinalPath: '/manager/charge-travail' }
    ]
  },
  {
    name: 'collaborateur',
    credentials: { email: 'collab@smartassign.tn', motDePasse: 'collab123' },
    routes: [
      { path: '/dashboard' },
      { path: '/mes-projets' },
      { path: '/planning' },
      { path: '/mon-profil' },
      { path: '/historique' }
    ]
  }
];

function createPublicTestUser() {
  const uniqueId = Date.now();

  return {
    nom: 'Smoke',
    prenom: 'Public',
    email: `smoke.public.${uniqueId}@smartassign.tn`,
    motDePasse: PUBLIC_FLOW_PASSWORD
  };
}

function buildResult(path, finalUrl, snippet, apiResponses, expectedFinalPath, requiredSnippets = []) {
  const failingResponse = apiResponses.find((item) => item.status >= 400);
  const finalPath = normalizePathname(finalUrl);
  const redirectFailure = finalPath !== expectedFinalPath
    ? { expectedFinalPath, actualFinalPath: finalPath }
    : null;
  const missingSnippets = requiredSnippets.filter((value) => !snippet.includes(value));
  const contentFailure = missingSnippets.length
    ? { missingSnippets }
    : null;

  return {
    path,
    expectedFinalPath,
    finalUrl,
    snippet,
    requiredSnippets,
    apiResponses,
    ok: !failingResponse && !redirectFailure && !contentFailure,
    failingResponse,
    redirectFailure,
    contentFailure
  };
}

async function fillInputByLabel(page, label, value, index = 0) {
  const groupInput = page.locator('.form-group', { hasText: label }).nth(index).locator('input');

  if (await groupInput.count()) {
    await groupInput.fill(value);
    return;
  }

  const placeholderInput = page.getByPlaceholder(label).nth(index);

  if (await placeholderInput.count()) {
    await placeholderInput.fill(value);
    return;
  }

  throw new Error(`Input not found for label or placeholder: ${label}`);
}

async function waitForButtonEnabled(page, selector, timeout = 15000) {
  await page.waitForFunction(
    (buttonSelector) => {
      const button = document.querySelector(buttonSelector);
      return button instanceof HTMLButtonElement && !button.disabled;
    },
    selector,
    { timeout }
  );
}

function isSmokePublicEmail(email) {
  return typeof email === 'string'
    && email.startsWith('smoke.public.')
    && email.endsWith('@smartassign.tn');
}

async function cleanupPublicTestUsers(apiContext, specificEmail = null) {
  const adminUser = await authenticate(apiContext, ADMIN_CREDENTIALS);
  const headers = {
    Authorization: `Bearer ${adminUser.token}`
  };

  const listResponse = await apiContext.get(`${API_URL}/admin/collaborateurs`, {
    headers
  });

  if (!listResponse.ok()) {
    throw new Error(`Cleanup list failed: ${listResponse.status()}`);
  }

  const collaborateurs = await listResponse.json();
  const candidates = collaborateurs.filter((collaborateur) => {
    if (!isSmokePublicEmail(collaborateur.email)) {
      return false;
    }

    if (specificEmail) {
      return collaborateur.email === specificEmail;
    }

    return true;
  });

  for (const collaborateur of candidates) {
    const deleteResponse = await apiContext.delete(`${API_URL}/admin/collaborateurs/${collaborateur.id}`, {
      headers
    });

    if (!deleteResponse.ok() && deleteResponse.status() !== 404) {
      throw new Error(`Cleanup delete failed for ${collaborateur.email}: ${deleteResponse.status()}`);
    }
  }
}

async function smokePublicFlow(browser, signupUser) {
  const signupContext = await browser.newContext();
  const signupPage = await signupContext.newPage();
  const signupApiResponses = captureApiResponses(signupPage);
  const publicResults = [];

  try {
    await signupPage.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    const accueilSnippet = (await signupPage.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    publicResults.push(buildResult('/', signupPage.url(), accueilSnippet.slice(0, 180), consumeApiResponses(signupApiResponses), '/', ["S'inscrire", 'Se connecter']));

    await signupPage.getByRole('link', { name: /S'inscrire/i }).click();
    await signupPage.waitForURL('**/signup');
    const signupSnippet = (await signupPage.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    publicResults.push(buildResult('/signup', signupPage.url(), signupSnippet.slice(0, 180), consumeApiResponses(signupApiResponses), '/signup', ['SMARTASSIGN', 'Créez votre']));

    await fillInputByLabel(signupPage, 'Nom', signupUser.nom);
    await fillInputByLabel(signupPage, 'Prénom', signupUser.prenom);
    await fillInputByLabel(signupPage, 'Email', signupUser.email);

    await fillInputByLabel(signupPage, 'Mot de passe', signupUser.motDePasse);
    await fillInputByLabel(signupPage, 'Confirmer le mot de passe', signupUser.motDePasse);
    await waitForButtonEnabled(signupPage, '.btn-main');
    await signupPage.getByRole('button', { name: /Créer mon compte/i }).click();
    await signupPage.waitForURL('**/dashboard', { timeout: 15000 });

    const dashboardSnippet = (await signupPage.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    publicResults.push(buildResult('/signup -> /dashboard', signupPage.url(), dashboardSnippet.slice(0, 180), consumeApiResponses(signupApiResponses), '/dashboard'));
  } finally {
    await signupContext.close();
  }

  const loginContext = await browser.newContext();
  const loginPage = await loginContext.newPage();
  const loginApiResponses = captureApiResponses(loginPage);

  try {
    await loginPage.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });
    const loginSnippet = (await loginPage.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    publicResults.push(buildResult('/login', loginPage.url(), loginSnippet.slice(0, 180), consumeApiResponses(loginApiResponses), '/login', ['SMARTASSIGN', 'La bonne personne']));

    await fillInputByLabel(loginPage, 'Email', signupUser.email);
    await fillInputByLabel(loginPage, 'Mot de passe', signupUser.motDePasse);
    await loginPage.getByRole('button', { name: /Se connecter/i }).click();
    await loginPage.waitForURL('**/dashboard', { timeout: 15000 });

    const loginDashboardSnippet = (await loginPage.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    publicResults.push(buildResult('/login -> /dashboard', loginPage.url(), loginDashboardSnippet.slice(0, 180), consumeApiResponses(loginApiResponses), '/dashboard'));
  } finally {
    await loginContext.close();
  }

  return publicResults;
}

async function smokeRole(browser, user, roleConfig) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const apiResponses = captureApiResponses(page);

  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((authUser) => {
    localStorage.setItem('smartassign_user', JSON.stringify(authUser));
    localStorage.setItem('token', authUser.token);
  }, user);

  const results = [];

  for (const route of roleConfig.routes) {
    const expectedFinalPath = route.expectedFinalPath || route.path;

    await page.goto(`${FRONTEND_URL}${route.path}`, { waitUntil: 'networkidle' });
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    results.push(buildResult(
      route.path,
      page.url(),
      bodyText.slice(0, 180),
      consumeApiResponses(apiResponses),
      expectedFinalPath
    ));
  }

  await context.close();
  return results;
}

function printSummary(report) {
  const flattened = report.flatMap((entry) => entry.results.map((result) => ({ role: entry.role, ...result })));
  const failures = flattened.filter((result) => !result.ok);

  console.log(JSON.stringify({ report }, null, 2));

  if (failures.length) {
    console.error('\nSmoke test failures detected:');
    for (const failure of failures) {
      console.error(`- [${failure.role}] ${failure.path} -> ${failure.finalUrl}`);
      if (failure.failingResponse) {
        console.error(`  API ${failure.failingResponse.status}: ${failure.failingResponse.url}`);
      }
      if (failure.redirectFailure) {
        console.error(`  Redirect mismatch: expected ${failure.redirectFailure.expectedFinalPath}, got ${failure.redirectFailure.actualFinalPath}`);
      }
      if (failure.contentFailure) {
        console.error(`  Missing content: ${failure.contentFailure.missingSnippets.join(', ')}`);
      }
    }
    process.exitCode = 1;
  }
}

async function main() {
  await ensureServiceReady(FRONTEND_URL, 90000);
  await ensureServiceReady(`${API_URL}/projets`, 90000);

  const apiContext = await createApiContext();
  const browser = await launchBrowser();
  const signupUser = createPublicTestUser();

  try {
    const report = [];

    await cleanupPublicTestUsers(apiContext);

    report.push({ role: 'public', results: await smokePublicFlow(browser, signupUser) });

    for (const roleConfig of ROLE_CONFIGS) {
      const user = await authenticate(apiContext, roleConfig.credentials);
      const results = await smokeRole(browser, user, roleConfig);
      report.push({ role: roleConfig.name, results });
    }

    printSummary(report);
  } finally {
    await cleanupPublicTestUsers(apiContext);
    await browser.close();
    await apiContext.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});