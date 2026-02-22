const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  const { cf_id } = event.queryStringParameters || {};

  try {
    const isProd = process.env.CASHFREE_PROD === 'true';
    const cfUrl = isProd ? `https://api.cashfree.com/pg/orders/${cf_id}` : `https://sandbox.cashfree.com/pg/orders/${cf_id}`;

    const response = await axios.get(
      cfUrl,
      {
        headers: {
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
          'x-api-version': '2023-08-01'
        }
      }
    );

    if (response.data.order_status === 'PAID') {
      // 1. Get the order id from Supabase
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('cashfree_order_id', cf_id)
        .single();

      if (orderError) throw orderError;

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
            // We use simple update here. In production, an RPC call for atomic decrement is better.
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

    return { statusCode: 400, body: "Payment Failed" };
  } catch (error) {
    console.error('Verify Payment Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};