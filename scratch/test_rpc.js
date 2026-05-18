const fs = require('fs');

// Read VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env
const envPath = '/Users/devjr1/Documents/Yo/la30-front/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
console.log('Supabase URL:', supabaseUrl);

async function test() {
  const rpcUrl = `${supabaseUrl}/rest/v1/rpc/process_payment`;

  console.log('Testing RPC with 6 args:');
  const response6 = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({
      p_order_id: '00000000-0000-0000-0000-000000000000',
      p_method: 'efectivo',
      p_amount_received: 0,
      p_amt_efectivo: 0,
      p_amt_tarjeta: 0,
      p_amt_nequi: 0
    })
  });
  console.log('Status 6:', response6.status);
  console.log('Response 6:', await response6.text());

  console.log('\nTesting RPC with 3 args:');
  const response3 = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({
      p_order_id: '00000000-0000-0000-0000-000000000000',
      p_method: 'efectivo',
      p_amount_received: 0
    })
  });
  console.log('Status 3:', response3.status);
  console.log('Response 3:', await response3.text());
}

test().catch(console.error);
