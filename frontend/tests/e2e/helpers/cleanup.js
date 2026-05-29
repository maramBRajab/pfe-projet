const { expect } = require('@playwright/test');
const { API_URL, loginViaApi } = require('./auth');

const ADMIN_CREDENTIALS = { email: 'admin@smartassign.tn', motDePasse: 'admin123' };

function isSmokePublicEmail(email) {
  return typeof email === 'string'
    && email.startsWith('smoke.public.')
    && email.endsWith('@smartassign.tn');
}

async function cleanupPublicTestUsers(request, specificEmail = null) {
  const adminUser = await loginViaApi(request, ADMIN_CREDENTIALS);
  const headers = {
    Authorization: `Bearer ${adminUser.token}`
  };

  const listResponse = await request.get(`${API_URL}/admin/collaborateurs`, { headers });
  expect(listResponse.ok()).toBeTruthy();

  const collaborateurs = await listResponse.json();
  const candidates = collaborateurs.filter((collaborateur) => {
    if (!isSmokePublicEmail(collaborateur.email)) {
      return false;
    }

    return specificEmail ? collaborateur.email === specificEmail : true;
  });

  for (const collaborateur of candidates) {
    const deleteResponse = await request.delete(`${API_URL}/admin/collaborateurs/${collaborateur.id}`, { headers });
    expect([204, 404]).toContain(deleteResponse.status());
  }
}

module.exports = {
  cleanupPublicTestUsers
};