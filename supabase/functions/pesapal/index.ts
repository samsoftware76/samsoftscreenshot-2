import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Pesapal OAuth endpoints
const PESAPAL_BASE = 'https://pay.pesapal.com/v3'; // Production
// const PESAPAL_BASE = 'https://cybqa.pesapal.com/pesapalv3'; // Sandbox

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const PESAPAL_CONSUMER_KEY = Deno.env.get('PESAPAL_CONSUMER_KEY');
    const PESAPAL_CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET');

    if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
      throw new Error('Pesapal credentials not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get auth token
    const authRes = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        consumer_key: PESAPAL_CONSUMER_KEY,
        consumer_secret: PESAPAL_CONSUMER_SECRET,
      }),
    });

    if (!authRes.ok) throw new Error(`Pesapal auth failed: ${await authRes.text()}`);
    const { token } = await authRes.json();

    if (action === 'register-ipn') {
      // Register IPN URL
      const body = await req.json();
      const ipnRes = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          url: body.ipn_url,
          ipn_notification_type: 'GET',
        }),
      });
      const ipnData = await ipnRes.json();
      return new Response(JSON.stringify(ipnData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'submit-order') {
      const body = await req.json();
      const orderRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          id: body.order_id,
          currency: 'USD',
          amount: 10,
          description: 'Software Challenge Solver - Monthly Subscription',
          callback_url: body.callback_url,
          notification_id: body.ipn_id,
          billing_address: {
            email_address: body.email,
            first_name: body.first_name || '',
            last_name: body.last_name || '',
          },
        }),
      });
      const orderData = await orderRes.json();
      return new Response(JSON.stringify(orderData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'check-status') {
      const orderTrackingId = url.searchParams.get('orderTrackingId');
      const statusRes = await fetch(`${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const statusData = await statusRes.json();
      return new Response(JSON.stringify(statusData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Pesapal error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
