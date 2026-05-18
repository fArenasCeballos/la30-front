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

async function test() {
  const rpcUrl = `${supabaseUrl}/rest/v1/rpc/process_payment`;

  // First, fetch the latest order
  const ordersUrl = `${supabaseUrl}/rest/v1/orders?select=id,status,total&limit=1&order=created_at.desc`;
  const ordersResponse = await fetch(ordersUrl, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  const orders = await ordersResponse.json();
  if (!orders || orders.length === 0) {
    console.log('No orders found in database!');
    return;
  }

  const realOrder = orders[0];
  console.log('Found latest order:', realOrder);

  console.log('\nCalling process_payment on real order:');
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({
      p_order_id: realOrder.id,
      p_method: 'efectivo',
      p_amount_received: realOrder.total,
      p_amt_efectivo: realOrder.total,
      p_amt_tarjeta: 0,
      p_amt_nequi: 0
    })
  });

  console.log('Status:', response.status);
  console.log('Response:', await response.text());
}

test().catch(console.error);
