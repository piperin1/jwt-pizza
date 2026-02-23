import { test, expect } from 'playwright-test-coverage';

async function basicInit(page) {
  let loggedInUser = null;
  const users = {
    'edit@jwt.com': {
      id: '10',
      name: 'pizza diner',
      email: 'edit@jwt.com',
      password: 'diner',
      roles: [{ role: 'diner' }],
    },
  };

  await page.route('**/api/auth', async (route) => {
    const body = route.request().postDataJSON();
    const user = users[body.email];

    if (!user || user.password !== body.password) {
      await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      return;
    }

    loggedInUser = user;

    await route.fulfill({
      json: {
        user: loggedInUser,
        token: 'mock-token',
      },
    });
  });

  await page.route('**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('**/api/user', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      users[loggedInUser.email].name = body.name;
      loggedInUser = users[loggedInUser.email];

      await route.fulfill({
        json: loggedInUser,
      });
      return;
    }

    await route.continue();
  });

  await page.goto('/');
}

test('updateUser', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('edit@jwt.com');
  await page.getByPlaceholder('Password').fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'pd' }).click();
  await expect(page.getByRole('main')).toContainText('pizza diner');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');

  await page.getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();
});