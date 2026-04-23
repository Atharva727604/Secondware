const crypto = require('crypto');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service role env vars');
  return createClient(url, key);
}

// Nodemailer transporter (reuse existing pattern)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function verifySignature(secret, payloadRaw, signatureHeader) {
  if (!secret) return true; // no secret configured, skip verification
  if (!signatureHeader) return false;
  const hmac = crypto.createHmac('sha256', secret).update(payloadRaw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signatureHeader));
}

function extractShipmentInfo(body) {
  // Support a few common shapes. Return { shipmentId, trackingNumber, status, events, eventId }
  const out = { shipmentId: null, trackingNumber: null, status: null, events: null, eventId: null };
  if (!body) return out;

  if (body.shipment_id) out.shipmentId = String(body.shipment_id);
  if (body.shipment && body.shipment.id) out.shipmentId = String(body.shipment.id);
  if (body.data?.shipment?.id) out.shipmentId = String(body.data.shipment.id);

  if (body.tracking_number) out.trackingNumber = String(body.tracking_number);
  if (body.tracking?.number) out.trackingNumber = String(body.tracking.number);

  if (body.status) out.status = String(body.status).toLowerCase();
  if (body.event?.status) out.status = String(body.event.status).toLowerCase();
  if (body.data?.status) out.status = String(body.data.status).toLowerCase();

  if (Array.isArray(body.events)) out.events = body.events;
  if (body.tracking?.events) out.events = body.tracking.events;

  // Event / webhook id to support idempotency
  if (body.id) out.eventId = String(body.id);
  if (body.event && body.event.id) out.eventId = String(body.event.id);
  if (body.data && body.data.id) out.eventId = String(body.data.id);
  if (body.meta && body.meta.event_id) out.eventId = String(body.meta.event_id);

  return out;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const payloadRaw = event.body || '';

    // Verify signature if configured
    const sigHeader = event.headers['x-porter-signature'] || event.headers['x-signature'] || event.headers['x-hook-signature'];
    const secret = process.env.PORTER_WEBHOOK_SECRET || '';
    if (!verifySignature(secret, payloadRaw, sigHeader)) {
      console.warn('Invalid or missing webhook signature');
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
    }

    let body;
    try {
      body = typeof payloadRaw === 'string' ? JSON.parse(payloadRaw) : payloadRaw;
    } catch (e) {
      console.warn('Webhook payload parse error:', e.message);
      body = {};
    }

    const info = extractShipmentInfo(body);

    if (!info.shipmentId && !info.trackingNumber) {
      console.warn('No shipment id or tracking number in webhook');
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing shipment id or tracking number' }) };
    }

    const adminSupabase = getAdminSupabase();

    // Find the order by porter_shipment_id or tracking_number
    let orderQuery = adminSupabase.from('orders').select('*');
    if (info.shipmentId) orderQuery = orderQuery.or(`porter_shipment_id.eq.${info.shipmentId},tracking_number.eq.${info.shipmentId}`);
    else orderQuery = orderQuery.or(`tracking_number.eq.${info.trackingNumber}`);

    const { data: orders, error: fetchErr } = await orderQuery.limit(1);
    if (fetchErr) {
      console.error('Error querying order for webhook:', fetchErr);
      return { statusCode: 500, body: JSON.stringify({ error: 'DB query error' }) };
    }

    if (!orders || orders.length === 0) {
      console.warn('No matching order found for shipment:', info.shipmentId || info.trackingNumber);
      return { statusCode: 200, body: JSON.stringify({ message: 'No order matched' }) };
    }

    const order = orders[0];
    // Idempotency: skip if this event was already processed
    const eventId = info.eventId || event.headers['x-event-id'] || event.headers['x-hook-id'];
    if (eventId && order.last_porter_event_id && String(order.last_porter_event_id) === String(eventId)) {
      return { statusCode: 200, body: JSON.stringify({ message: 'Duplicate event, ignored' }) };
    }

    // Decide new status (simple mapping)
    const incomingStatus = info.status || (info.events && info.events[0] && (info.events[0].status || info.events[0].description));
    const normalizedStatus = incomingStatus ? String(incomingStatus).toLowerCase() : null;

    const updates = {};
    if (info.shipmentId) updates.porter_shipment_id = info.shipmentId;
    if (info.trackingNumber) updates.tracking_number = info.trackingNumber;
    if (normalizedStatus) updates.status = normalizedStatus;

    // Attach event id to updates for idempotency tracking
    if (eventId) updates.last_porter_event_id = eventId;

    // Only update if something changed
    const shouldUpdate = Object.keys(updates).some(k => String(order[k] || '') !== String(updates[k] || ''));

    if (!shouldUpdate) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No changes' }) };
    }

    const { data: updatedOrder, error: updateErr } = await adminSupabase
      .from('orders')
      .update(updates)
      .eq('id', order.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Failed to update order from webhook:', updateErr);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to update order' }) };
    }

    // Send notification email if status changed
    if (normalizedStatus && String(order.status || '').toLowerCase() !== normalizedStatus) {
      try {
        if (updatedOrder.customer_email && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: updatedOrder.customer_email,
            subject: `Order #${updatedOrder.id} status update: ${normalizedStatus}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width:600px;">
                <h2>Order Update</h2>
                <p>Hi ${updatedOrder.customer_name || 'Customer'},</p>
                <p>Your order <strong>#${updatedOrder.id}</strong> status has been updated to <strong>${normalizedStatus}</strong>.</p>
                <p>Tracking: ${updatedOrder.tracking_number || updatedOrder.porter_shipment_id || 'N/A'}</p>
                <p>Thanks for shopping with us.</p>
              </div>
            `
          };
          await transporter.sendMail(mailOptions);
        } else {
          console.warn('Email credentials not configured or no customer email. Skipping email.');
        }
      } catch (mailErr) {
        console.error('Failed to send webhook notification email:', mailErr);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Order updated' }) };
  } catch (err) {
    console.error('porter-webhook error:', err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Unknown error' }) };
  }
};
