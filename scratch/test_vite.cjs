const urls = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

async function check() {
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(500) });
      console.log(`${url}: SUCCESS (${res.status})`);
    } catch (e) {
      console.log(`${url}: FAILED (${e.message})`);
    }
  }
}

check();
