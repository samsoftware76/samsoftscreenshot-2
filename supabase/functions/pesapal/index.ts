import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PESAPAL_BASE = 'https://pay.pesapal.com/v3';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // 1. Initialize Supabase Clients
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Validate User
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error(`Unauthorized: ${userError?.message || 'User not found'}`);

    const PESAPAL_CONSUMER_KEY = Deno.env.get('PESAPAL_CONSUMER_KEY');
    const PESAPAL_CONSUMER_SECRET = Deno.env.get('PESAPAL_CONSUMER_SECRET');
    const PESAPAL_IPN_ID = Deno.env.get('PESAPAL_IPN_ID');

    if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
      throw new Error('Pesapal credentials not configured in Supabase Secrets');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'initiate';

    // 3. Get OAuth token
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

    // 4. Multitenancy Provisioning (Service Role)
    let { data: membership } = await serviceRoleClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      console.log(`No organization found for user ${user.id}, provisioning new workspace...`);

      const { data: newOrg } = await serviceRoleClient.from('organizations').insert({
        name: `${user.email?.split('@')[0]}'s Workspace`,
        slug: `org-${user.id.substring(0, 8)}-pay-${Math.random().toString(36).substring(2, 5)}`
      }).select().single();

      if (newOrg) {
        await serviceRoleClient.from('organization_members').insert({
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'owner'
        });
        membership = { organization_id: newOrg.id };
      }
    }

    const organizationId = membership?.organization_id;

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

      // Record transaction (Use USER client for RLS)
      if (organizationId) {
        await supabaseClient.from('pesapal_transactions').insert({
          organization_id: organizationId,
          user_id: user.id,
          merchant_reference: merchantRef,
          amount: orderPayload.amount,
          currency: orderPayload.currency,
          description: orderPayload.description,
          status: 'PENDING'
        });
      }

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

      // Update with tracking ID
      if (orderRes.ok && orderData.order_tracking_id) {
        await supabaseClient
          .from('pesapal_transactions')
          .update({ order_tracking_id: orderData.order_tracking_id })
          .eq('merchant_reference', merchantRef);
      }

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

      // Sync status to DB and allocate credits if completed
      if (statusData.payment_status_description) {
        const { data: oldTx } = await serviceRoleClient
          .from('pesapal_transactions')
          .select('status, amount, user_id, organization_id')
          .eq('order_tracking_id', orderTrackingId)
          .single();

        await serviceRoleClient
          .from('pesapal_transactions')
          .update({
            status: statusData.payment_status_description,
            payment_method: statusData.payment_method
          })
          .eq('order_tracking_id', orderTrackingId);

        if (statusData.payment_status_description === 'Completed' && oldTx?.status !== 'Completed') {
          // 1. Award Credits (10 credits per USD by default, or 100 for a standard $10 sub)
          const creditsToAward = 100;
          await serviceRoleClient.rpc('add_credits', { user_id: oldTx.user_id, amount: creditsToAward });

          // 2. Update Organization Billing
          if (oldTx.organization_id) {
            await serviceRoleClient
              .from('organizations')
              .update({ billing_status: 'active' })
              .eq('id', oldTx.organization_id);
          }

          // 3. Notify User
          await serviceRoleClient.from('notifications').insert({
            user_id: oldTx.user_id,
            type: 'SUBSCRIPTION_SUCCESS',
            recipient_email: user.email,
            message: `Success! You have been awarded ${creditsToAward} credits for your subscription.`
          });

          // 4. Notify Admin (samsoftware75@gmail.com)
          await serviceRoleClient.from('notifications').insert({
            type: 'SYSTEM',
            recipient_email: 'samsoftware75@gmail.com',
            message: `ADMIN ALERT: New subscription completed by ${user.email}. Amount: ${oldTx.amount}. Credits Awarded: ${creditsToAward}.`
          });
        }
      }

      return new Response(JSON.stringify(statusData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Invalid action');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Pesapal Edge Function Error:', msg);
    return new Response(JSON.stringify({
      error: msg,
      details: 'Please check Supabase Edge Function logs for details.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
