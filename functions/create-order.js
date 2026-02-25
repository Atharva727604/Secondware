const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const { items, customer_details } = body;
  const authToken = event.headers.authorization?.replace('Bearer ', '');

  // Detect Site URL for redirects
  const referer = event.headers.referer || '';
  const origin = event.headers.origin || '';
  let siteUrl = process.env.URL;

  if (!siteUrl) {
    siteUrl = origin || (referer ? new URL(referer).origin : '');
  }

  if (!siteUrl || siteUrl.includes('localhost')) {
    siteUrl = siteUrl || 'http://localhost:8888';
  }

  siteUrl = siteUrl.replace(/\/$/, '');

  try {
    // 1. Verify user authentication
    if (!authToken) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid Session' }) };
    }

    // 2. Validate items and calculate total
    if (!items || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No items in cart' }) };
    }

    const deliveryFee = body.delivery_fee || 0;

    // Verify products exist and calculate total
    let productTotal = 0;
    for (const item of items) {
      const { data: product, error } = await supabase
        .from('products')
        .select('price, stock_quantity')
        .eq('id', item.product_id)
        .single();

      if (error || !product) {
        return { statusCode: 400, body: JSON.stringify({ error: `Product ${item.product_id} not found` }) };
      }

      if (product.stock_quantity < item.quantity) {
        return { statusCode: 400, body: JSON.stringify({ error: `Insufficient stock for product ${item.product_id}` }) };
      }

      productTotal += product.price * item.quantity;
    }

    const totalAmount = productTotal + deliveryFee;

    // 3. Create order in Supabase with customer details
    let order_id = Date.now(); // Fallback to timestamp if insertion fails

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: user.id,
          total_amount: totalAmount,
          status: 'pending',
          customer_name: customer_details.name,
          customer_email: customer_details.email,
          customer_phone: customer_details.phone,
          customer_address: customer_details.address,
          delivery_fee: deliveryFee
        }])
        .select();

      if (!orderError && orderData && orderData[0]) {
        order_id = orderData[0].id;
      } else {
        console.error('Order insertion error:', orderError);
      }
    } catch (err) {
      console.error('Orders table error:', err);
    }

    // 4. Prepare Cashfree Request
    const cashfreeData = {
      order_amount: totalAmount,
      order_currency: "INR",
      order_id: `ORDER_${order_id}`,
      customer_details: {
        customer_id: user.id,
        customer_email: customer_details.email,
        customer_phone: customer_details.phone
      },
      order_meta: {
        return_url: `${siteUrl}/catalog.html?payment=success&order_id={order_id}`
      }
    };

    // 5. Call Cashfree API
    const isProd = process.env.CASHFREE_PROD === 'true';
    const cfUrl = isProd ? 'https://api.cashfree.com/pg/orders' : 'https://sandbox.cashfree.com/pg/orders';

    const cfResponse = await axios.post(
      cfUrl,
      cashfreeData,
      {
        headers: {
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
          'x-api-version': '2023-08-01',
          'Content-Type': 'application/json'
        }
      }
    );

    // 6. Update order with Cashfree reference
    try {
      const { error: updateError } = await supabase.from('orders').update({
        cashfree_order_id: cfResponse.data.cf_order_id
      }).eq('id', order_id);

      if (updateError) {
        console.error('Order update error:', updateError);
      }
    } catch (err) {
      console.error('Order update exception:', err);
    }

    // 7. Insert order items
    try {
      const orderItems = items.map(item => ({
        order_id: order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Order items insertion error:', itemsError);
      }
    } catch (err) {
      console.error('Order items exception:', err);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        payment_session_id: cfResponse.data.payment_session_id,
        order_id: order_id
      })
    };

  } catch (error) {
    console.error('Order creation error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: error.response?.data?.message || error.message
      })
    };
  }
};