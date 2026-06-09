const PUBLIC_FLOW_PASSWORD = process.env.SMOKE_PUBLIC_PASSWORD;

function createPublicTestUser() {
  const uniqueId = Date.now();

  return {
    nom: 'Smoke',
    prenom: 'Public',
    email: `smoke.public.${uniqueId}@smartassign.tn`,
    motDePasse: PUBLIC_FLOW_PASSWORD
  };
}

async function fillInputByPlaceholder(page, placeholder, value, index = 0) {
  await page.getByPlaceholder(placeholder).nth(index).fill(value);
}

module.exports = {
  createPublicTestUser,
  fillInputByPlaceholder
};
