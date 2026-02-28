const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkOrder() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const orderId = '837a864e-762f-44c5-ae92-778dedaca806';

    console.log(`Checking order ${orderId}...`);
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();

    if (error) {
        console.error("Order not found or error:", error.message);
        // Let's look for ANY recent order
        const { data: recent } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1);
        console.log("Most recent order:", recent);
    } else {
        console.log("Order found:", order);

        // Also check order items
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
        console.log(`Order items for ${orderId}:`, items);
    }
}
checkOrder();
