import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PESAPAL_BASE = 'https://pay.pesapal.com/v3';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error(`Unauthorized: ${userError?.message || 'User not found'}`);

    const PESAPAL_CONSUMER_KEY = Deno.env.get('PESAPAL_CONSUMER_KEY');
    const PESAPAL_CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET');
    const PESAPAL_IPN_ID = Deno.env.get('PESAPAL_IPN_ID');

    if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
      throw new Error('Pesapal credentials not configured');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'initiate';

    // Get OAuth token
    const authRes = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        consumer_key: PESAPAL_CONSUMER_KEY,
        consumer_secret: PESAPAL_CONSUMER_SECRET,
      }),
    });

    if (!authRes.ok) throw new Error(`Pesapal Auth Failed: ${authRes.status}`);
    const { token } = await authRes.json();

    if (action === 'initiate' || action === 'submit-order') {
      const body = await req.json().catch(() => ({}));
      const merchantRef = body.order_id || body.merchant_reference || crypto.randomUUID();

      const orderPayload = {
        id: merchantRef,
        currency: body.currency || 'USD',
        amount: body.amount || 10,
        description: body.description || 'Subscription Upgrade',
        callback_url: body.callback_url || Deno.env.get('PESAPAL_CALLBACK_URL'),
        notification_id: body.ipn_id || PESAPAL_IPN_ID,
        redirect_mode: "0",
        billing_address: {
          email_address: body.email || user.email,
          phone_number: body.phone || "",
          first_name: body.firstName || user.email?.split('@')[0] || "",
          last_name: body.lastName || "",
        }
      };

      const orderRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderPayload),
      });

      const orderData = await orderRes.json();

      return new Response(JSON.stringify({
        success: orderRes.ok,
        redirect_url: orderData.redirect_url,
        order_tracking_id: orderData.order_tracking_id,
        ...orderData
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'check-status') {
      const orderTrackingId = url.searchParams.get('orderTrackingId');
      if (!orderTrackingId) throw new Error('orderTrackingId is required');

      const statusRes = await fetch(`${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
      });

      if (!statusRes.ok) throw new Error(`Status Check Failed: ${statusRes.status}`);
      const statusData = await statusRes.json();

      return new Response(JSON.stringify(statusData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Invalid action');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Pesapal Edge Function Error:', msg);
    return new Response(JSON.stringify({
      error: msg,
      details: 'Check edge function logs for details.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
