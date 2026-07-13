async function main() {
  const API_URL = 'http://localhost:3001/api/v1/admin';
  
  try {
    console.log('Logging in...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@texto.com',
        password: 'admin123'
      })
    });
    
    const loginJson = (await loginRes.json()) as any;
    if (!loginJson.success) {
      console.error('Login failed:', loginJson);
      return;
    }
    
    const token = loginJson.data.accessToken;
    console.log('Logged in successfully. Token obtained.');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 1. Fetch sites
    console.log('Fetching sites...');
    const sitesRes = await fetch(`${API_URL}/sites`, { headers });
    const sitesJson = (await sitesRes.json()) as any;
    console.log('Sites response:', JSON.stringify(sitesJson, null, 2));

    const siteId = sitesJson.data?.[0]?.id;
    if (!siteId) {
      console.log('No sites found to assign!');
      return;
    }

    // 2. Try to create warehouse with the siteId
    console.log(`Attempting to create warehouse with siteId: ${siteId}...`);
    const createRes = await fetch(`${API_URL}/warehouses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Web Test WH',
        code: 'WTW',
        siteId: siteId,
        isActive: true
      })
    });
    const createJson = (await createRes.json()) as any;
    console.log('Create warehouse response:', createJson);

  } catch (err: any) {
    console.error('General error:', err.message);
  }
}

main();
