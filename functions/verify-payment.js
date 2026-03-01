const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  let cf_id = params.cf_id || params.order_id;

  try {
    if (!cf_id) {
      return { statusCode: 400, body: "Missing order_id or cf_id" };
    }

    // If it's a UUID, it's our internal ID, we need to map it or it might already be the CF order_id
    // In our create-order.js, we send 'ORDER_uuid' so it's likely that.

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase environment variables (URL/SERVICE_KEY) are missing');

    const supabase = createClient(url, key);
    const appId = (process.env.CASHFREE_APP_ID || '').trim();
    const secretKey = (process.env.CASHFREE_SECRET_KEY || '').trim();
    const isProd = process.env.CASHFREE_PROD === 'true';

    if (!appId || !secretKey) {
      throw new Error("Cashfree credentials (APP_ID or SECRET_KEY) are missing or empty in environment variables.");
    }

    console.log(`[DEBUG] Verify Payment - Env Detection: CASHFREE_PROD=${process.env.CASHFREE_PROD}, isProd=${isProd}`);
    console.log(`[DEBUG] Verify Payment - AppId Check: ${appId.substring(0, 4)}...${appId.slice(-4)}`);

    const cfUrl = isProd ? `https://api.cashfree.com/pg/orders/${cf_id}` : `https://sandbox.cashfree.com/pg/orders/${cf_id}`;

    const response = await axios.get(
      cfUrl,
      {
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': '2023-08-01'
        }
      }
    );

    if (response.data.order_status === 'PAID') {
      // 1. Get the order id from Supabase
      // cf_id might be 'ORDER_uuid' or '2205...'
      const cleanId = cf_id.replace('ORDER_', '');

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, status')
        .or(`id.eq.${cleanId},cashfree_order_id.eq.${cf_id}`)
        .single();

      if (orderError) {
        // Fallback: search by cashfree_order_id using the ID from the response if available
        const cfInternalId = String(response.data.cf_order_id);
        const { data: fallbackOrder, error: fallbackError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('cashfree_order_id', cfInternalId)
          .single();

        if (fallbackError || !fallbackOrder) throw new Error("Order not found in database");
        return await proceedWithVerification(supabase, fallbackOrder);
      }

      return await proceedWithVerification(supabase, order);
    }

    return { statusCode: 400, body: "Payment Failed" };
  } catch (error) {
    console.error('Verify Payment Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function proceedWithVerification(supabase, order) {
  // 2. Only proceed if not already paid (idempotency)
  if (order.status !== 'paid') {
    // 3. Update Supabase order status to 'paid'
    await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id);

    // 4. Fetch order items to deduct stock
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order.id);

    if (!itemsError && items) {
      // 5. Deduct stock for each product
      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (product) {
          const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity);
          await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('id', item.product_id);
        }
      }
    }
  }
  return { statusCode: 200, body: "Payment Verified" };
}