const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
require('dotenv').config();

function debugLog(message) {
  const timestamp = new Date().toISOString();
  console.log(`[DEBUG][${timestamp}] ${message}`);

  if (process.env.ENABLE_FILE_LOGGING === 'true') {
    try {
      const logPath = path.join(process.cwd(), 'function_debug.log');
      fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf8');
    } catch (e) {
      // Silent catch for Netlify
    }
  }
}

function getSupabaseClient(authToken, useServiceRole = false) {
  const url = process.env.SUPABASE_URL;
  const key = useServiceRole ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error(`Supabase variables missing (${useServiceRole ? 'SERVICE' : 'ANON'})`);

  const options = {};
  if (authToken && !useServiceRole) {
    options.global = { headers: { Authorization: `Bearer ${authToken}` } };
  }
  return createClient(url, key, options);
}

exports.handler = async (event) => {
  // 0. Parse Body
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    debugLog(`JSON Parse Error: ${e.message}`);
    return { statusCode: 400, body: JSON.stringify({ error: 'Malformed JSON body' }) };
  }

  const { items, customer_details } = body;
  const authToken = event.headers.authorization?.replace('Bearer ', '') || event.headers.Authorization?.replace('Bearer ', '');

  try {
    debugLog(`--- Starting Order Creation ---`);
    const supabase = getSupabaseClient(authToken);
    const adminSupabase = getSupabaseClient(null, true);

    // Detect Site URL
    const referer = event.headers.referer || '';
    const origin = event.headers.origin || '';
    let siteUrl = process.env.URL || origin || (referer && referer.startsWith('http') ? new URL(referer).origin : 'http://localhost:8888');
    siteUrl = siteUrl.replace(/\/$/, '');

    // 1. Verify User
    // 1. Verify User
    if (!authToken) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(authToken);
    if (authError || !user) {
      debugLog(`Auth failed: ${authError?.message || 'No user'}`);
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid Session' }) };
    }

    // 2. Validate Cart
    if (!items || items.length === 0) return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty' }) };
    const deliveryFee = body.delivery_fee || 0;

    let productTotal = 0;
    for (const item of items) {
      const { data: product, error: pErr } = await adminSupabase.from('products').select('price, stock_quantity').eq('id', item.product_id).single();
      if (pErr || !product) throw new Error(`Product ${item.product_id} not found`);
      if (product.stock_quantity < item.quantity) throw new Error(`Insufficient stock for ${item.product_id}`);
      productTotal += product.price * item.quantity;
    }
    const totalAmount = productTotal + deliveryFee;

    // 3. Insert Order
    let order_id = null;
    const orderPayload = {
      user_id: user.id,
      total_amount: totalAmount,
      status: 'pending',
      customer_name: customer_details?.name || 'Customer',
      customer_email: customer_details?.email || user.email,
      customer_phone: customer_details?.phone || '',
      customer_address: customer_details?.address || '',
      delivery_fee: deliveryFee
    };

    debugLog(`Attempting Order Insert...`);
    const { data: oData, error: oErr } = await adminSupabase.from('orders').insert([orderPayload]).select();

    if (oErr) {
      debugLog(`Initial Insert Error: ${oErr.message}`);
      if (oErr.message.includes('delivery_fee')) {
        debugLog(`Retrying without delivery_fee...`);
        delete orderPayload.delivery_fee;
        const { data: rData, error: rErr } = await adminSupabase.from('orders').insert([orderPayload]).select();
        if (rErr) throw new Error(`Retry Insert Failed: ${rErr.message}`);
        order_id = rData[0].id;
      } else {
        throw new Error(`Order Insert Failed: ${oErr.message}`);
      }
    } else {
      order_id = oData[0].id;
    }
    debugLog(`Order Created: ${order_id}`);

    // 4. Razorpay Call
    const Razorpay = require('razorpay');
    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keyId || !keySecret) {
      throw new Error("Razorpay credentials (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET) are missing or empty in environment variables.");
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    debugLog(`Calling Razorpay API to create order...`);
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // amount in paise
      currency: "INR",
      receipt: order_id.length > 40 ? order_id.substring(0, 40) : order_id
    });

    const payment_session_id = rzpOrder.id; // Using payment_session_id variable to minimize client changes
    debugLog(`Razorpay Order Created: ID=${payment_session_id}`);

    // 5. Update Order with Razorpay ID (storing in cashfree_order_id column for compatibility)
    adminSupabase.from('orders').update({ cashfree_order_id: String(payment_session_id) }).eq('id', order_id).then(({ error }) => {
      if (error) debugLog(`Order Update Error: ${error.message}`);
    });
    // 6. Insert Order Items (Non-blocking)
    const orderItems = items.map(item => ({
      order_id: order_id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_purchase: item.price
    }));
    adminSupabase.from('order_items').insert(orderItems).then(({ error }) => {
      if (error) debugLog(`Order Items Error: ${error.message}`);
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        payment_session_id,
        order_id,
        razorpay_key_id: keyId,
        amount: totalAmount
      })
    };

  } catch (rzpErr) {
    debugLog(`Razorpay API Request Error: ${JSON.stringify(rzpErr)}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: rzpErr?.error?.description || rzpErr.message || "Unknown Razorpay error" })
    };
  }
};