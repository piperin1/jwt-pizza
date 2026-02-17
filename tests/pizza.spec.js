import { test, expect } from 'playwright-test-coverage';

async function basicInit(page) {
  let loggedInUser;
  const validUsers = { 
    'd@jwt.com': { 
      id: '3', 
      name: 'Kai Chen', 
      email: 'd@jwt.com', 
      password: 'a', 
      roles: [{ role: 'diner' }]
    }, 
    'admin@jwt.com': { 
    id: '4', name: 'Admin', email: 'admin@jwt.com', password: 'a', 
    roles: [{ role: 'admin' }] 
  },
  'f@jwt.com': { 
    id: '5', name: 'Franchisee', email: 'f@jwt.com', password: 'a', 
    roles: [{ role: 'franchisee' }] 
  }
  };

  await page.route('*/**/api/auth', async (route) => {
    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    
    loggedInUser = validUsers[loginReq.email];
    const loginRes = {
      user: loggedInUser,
      token: 'abcdef',
    };
    
    expect(route.request().method()).toBe('PUT'); 
    await route.fulfill({ json: loginRes });
  });

  // Return the currently logged in user
  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  // A standard menu
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      {
        id: 1,
        title: 'Veggie',
        image: 'pizza1.png',
        price: 0.0038,
        description: 'A garden of delight',
      },
      {
        id: 2,
        title: 'Pepperoni',
        image: 'pizza2.png',
        price: 0.0042,
        description: 'Spicy treat',
      },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  // Standard franchises and stores
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const franchiseRes = {
      franchises: [
        {
          id: 2,
          name: 'LotaPizza',
          stores: [
            { id: 4, name: 'Lehi' },
            { id: 5, name: 'Springville' },
            { id: 6, name: 'American Fork' },
          ],
        },
        { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
        { id: 4, name: 'topSpot', stores: [] },
      ],
      more:true
    };
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });

await page.route(/\/api\/franchise\/.*/, async (route) => {
  await route.fulfill({
    json: [
      {
        id: 10,
        name: 'Franchisee Pizza',
        stores: [
          { id: 1, name: 'Downtown', totalRevenue: 100 },
          { id: 2, name: 'Uptown', totalRevenue: 200 },
        ],
      },
    ],
  });
});

  // Order a pizza.
await page.route('**/api/order', async (route) => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify({
      orders: [
        {
          id: 101,
          items: [{ price: 10 }, { price: 15 }],
          date: new Date().toISOString(),
        },
      ],
      // Add user info here
      user: {
        id: '10',
        name: 'Test User',
        email: 'test@jwt.com',
        roles: [
          { role: 'diner' },
          { role: 'franchisee', objectId: '123' },
        ],
      },
    }),
  });
});


  await page.goto('/');
}

test('login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  // Go to order page
  await page.getByRole('button', { name: 'Order now' }).click();

  // Create order
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Login
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  // Pay
  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();
});

test('navigation quick wins', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/about/);
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page).toHaveURL(/history/);
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByPlaceholder('Full name').fill('New User');
  await page.getByPlaceholder('Email address').fill('new@jwt.com');
  await page.getByPlaceholder('Password').fill('password');
});

test('failed login coverage', async ({ page }) => {
  await page.route('*/**/api/auth', async (route) => {
    await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
  });
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill('wrong@test.com');
  await page.getByPlaceholder('Password').fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Unauthorized')).toBeVisible();
});

test('admin dashboard renders franchises and actions', async ({ page }) => {
  await basicInit(page);
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill('admin@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.goto('/admin-dashboard');
  await expect(page.getByText('Franchises')).toBeVisible();
await expect(
  page.getByRole('columnheader', { name: 'Franchise', exact: true })
).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' }).first()).toBeVisible();
  await page.getByPlaceholder('Filter franchises').fill('Lota');
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByRole('button', { name: '»' }).click();
  await page.getByRole('button', { name: '«' }).click();
  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await expect(page).toHaveURL(/create-franchise/);
});

test('franchise dashboard renders stores and allows navigation', async ({ page }) => {
  await basicInit(page);
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill('f@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.goto('/franchise-dashboard');
  await expect(page.getByText('Downtown')).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Name', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page).toHaveURL(/create-store/);
});

test('franchise dashboard shows marketing page if no franchise', async ({ page }) => {
  await basicInit(page);
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.goto('/franchise-dashboard');
  await expect(page.getByText('So you want a piece of the pie?')).toBeVisible();
});

test('logout clears user and redirects', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'fake-token');
  });
  await page.route('**/api/auth', async route => {
    await route.fulfill({ status: 200, body: JSON.stringify({}) });
  });
  await page.goto('/logout');
  await expect(page).toHaveURL('/');
});

test('login stores token', async ({ page }) => {
  await page.route('**/api/auth', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        user: { id: 1, name: 'Test' },
        token: 'abc123'
      })
    });
  });
  await page.goto('/login');
  await page.fill('input[type="email"]', 'test@test.com');
  await page.fill('input[type="password"]', 'password');
  await page.getByRole('button', { name: 'Login' }).click();
});

test('handles failed api call', async ({ page }) => {
  await page.route('**/api/franchise*', async route => {
    await route.fulfill({
      status: 500,
      body: JSON.stringify({ message: 'Server error' })
    });
  });

  await page.goto('/admin');
});

test('factory docs endpoint loads', async ({ page }) => {
  await page.route('**/api/docs', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({})
    });
  });

  await page.goto('/docs?type=factory');
});

test('diner dashboard renders order history table', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'fake-token');
  });
  await page.route('**/api/order', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        orders: [
          {
            id: 101,
            items: [{ price: 10 }, { price: 15 }],
            date: new Date().toISOString()
          }
        ]
      })
    });
  });
  await page.goto('/diner');
});

test('diner dashboard renders empty order state', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'fake-token');
  });
  await page.route('**/api/order', async route => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ orders: [] })
    });
  });
  await page.goto('/diner');
});

test('diner dashboard full coverage', async ({ page }) => {
  await basicInit(page);
  await page.route('*/**/api/auth', async (route) => {
    await route.fulfill({
      json: {
        token: 'abc',
        user: { 
          id: '3', 
          name: 'Kai Chen', 
          email: 'd@jwt.com', 
          roles: [{ role: 'diner' }, { role: 'franchisee', objectId: '99' }] 
        },
      },
    });
  });
  await page.route('**/api/order', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        orders: [
          { id: 101, items: [{ price: 0.001 }, { price: 0.002 }], date: '2024-05-20' },
        ],
      },
    });
  });
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.goto('/diner-dashboard');
  await expect(page.getByRole('cell', { name: '101' })).toBeVisible();
  await expect(page.getByText('0.003 ₿')).toBeVisible();
});

test('diner dashboard empty state coverage', async ({ page }) => {
  await basicInit(page);
  await page.route('**/api/order', async (route) => {
    await route.fulfill({ status: 200, json: { orders: [] } });
  });
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.goto('/diner-dashboard');
  await expect(page.getByText('How have you lived this long')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buy one' })).toHaveAttribute('href', '/menu');
});