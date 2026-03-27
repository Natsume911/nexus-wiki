async function globalSetup() {
  // Wait for backend health
  const backendUrl = 'http://localhost:4000/api/health';
  const frontendUrl = 'http://localhost:3000/wiki/';

  for (const url of [backendUrl, frontendUrl]) {
    let retries = 30;
    while (retries > 0) {
      try {
        const res = await fetch(url);
        if (res.ok) break;
      } catch { /* retry */ }
      retries--;
      await new Promise(r => setTimeout(r, 2000));
    }
    if (retries <= 0) {
      throw new Error(`Service not available: ${url}`);
    }
  }
}

export default globalSetup;
