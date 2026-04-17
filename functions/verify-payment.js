const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  let rzp_payment_id = params.rzp_payment_id;
  let order_id = params.order_id;

  try {
    if (!order_id || !rzp_payment_id) {
      return { statusCode: 400, body: "Missing order_id or rzp_payment_id" };
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase environment variables (URL/SERVICE_KEY) are missing');

    const supabase = createClient(url, key);
    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keyId || !keySecret) {
      throw new Error("Razorpay credentials (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET) are missing or empty in environment variables.");
    }

    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const payment = await razorpay.payments.fetch(rzp_payment_id);

    if (payment.status === 'captured' || payment.status === 'authorized') {
      const cleanId = order_id.replace('ORDER_', '');

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', cleanId)
        .single();

      if (orderError || !order) {
        throw new Error("Order not found in database");
      }

      return await proceedWithVerification(supabase, order);
    }

    return { statusCode: 400, body: "Payment Failed or Not Captured" };
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