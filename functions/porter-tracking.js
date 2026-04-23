const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

function getSupabaseClient(authToken) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  const options = authToken ? { global: { headers: { Authorization: `Bearer ${authToken}` } } } : {};
  return createClient(url, key, options);
}

exports.handler = async (event) => {
  try {
    const token = event.headers.authorization?.replace('Bearer ', '') || '';
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'No token provided' }) };

    const supabase = getSupabaseClient(token);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };

    const orderId = event.queryStringParameters?.order_id;
    if (!orderId) return { statusCode: 400, body: JSON.stringify({ error: 'order_id is required' }) };

    // Fetch order (RLS ensures non-admins only see own orders when using user token)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };

    // If the token user is not the owner, check admin role
    if (order.user_id !== user.id) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const shipmentId = order.porter_shipment_id || order.tracking_number;
    if (!shipmentId) return { statusCode: 404, body: JSON.stringify({ error: 'No tracking available for this order' }) };

    if (!process.env.PORTER_API_KEY || !process.env.PORTER_BASE_URL) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Porter env vars not configured' }) };
    }

    // Call Porter API (adjust path for your provider if needed)
    const porterUrl = `${process.env.PORTER_BASE_URL.replace(/\/$/, '')}/shipments/${encodeURIComponent(shipmentId)}/tracking`;
    const resp = await axios.get(porterUrl, {
      headers: { Authorization: `Bearer ${process.env.PORTER_API_KEY}` },
      timeout: 10000
    });

    return { statusCode: 200, body: JSON.stringify({ tracking: resp.data }) };
  } catch (err) {
    console.error('porter-tracking error:', err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Unknown error' }) };
  }
};
