const { createClient } = require('@supabase/supabase-js');
const { decode } = require('base64-arraybuffer');
const nodemailer = require('nodemailer');

// Supabase client factory logic moved inside handler for safety

function getSupabaseClient(authToken) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing Env Vars:", { url: !!url, key: !!key });
    throw new Error(`Supabase environment variables (URL: ${!!url}, ANON_KEY: ${!!key}) are missing`);
  }
  const options = authToken ? { global: { headers: { Authorization: `Bearer ${authToken}` } } } : {};
  return createClient(url, key, options);
}

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this or use host/port for other providers
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.handler = async (event) => {
  const method = event.httpMethod;
  const { action } = event.queryStringParameters || {};
  const authToken = event.headers.authorization?.replace('Bearer ', '');

  try {
    const supabase = getSupabaseClient(authToken);
    // 1. --- PUBLIC PRODUCTS (GET /api/products) ---
    // Return products for public GET requests as long as it's not an orders request
    if (method === 'GET' && action !== 'orders') {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: false });
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
    }

    // 2. --- USER ORDERS (Authenticated, non-admin) ---
    // Handles GET ?action=user-orders and POST ?action=cancel-order
    const isUserOrdersAction = (method === 'GET' && action === 'user-orders') ||
      (method === 'POST' && action === 'cancel-order');

    if (isUserOrdersAction || !authToken) {
      if (!authToken) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Unauthorized' })
        };
      }

      // Verify user token
      const { data: { user: authUser }, error: authUserError } = await supabase.auth.getUser(authToken);
      if (authUserError || !authUser) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid Session' })
        };
      }

      // GET user-orders: fetch orders for the logged-in user
      if (method === 'GET' && action === 'user-orders') {
        const { data: userOrders, error: userOrdersError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              *,
              products (id, name, price, image_url)
            )
          `)
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (userOrdersError) throw userOrdersError;
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userOrders)
        };
      }

      // POST cancel-order: cancel an order within 24 hours
      if (method === 'POST' && action === 'cancel-order') {
        const cancelBody = event.body ? JSON.parse(event.body) : {};
        const { order_id } = cancelBody;

        if (!order_id) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'order_id is required' })
          };
        }

        // Fetch the order and verify ownership
        const { data: orderToCancel, error: fetchOrderError } = await supabase
          .from('orders')
          .select('id, user_id, created_at, status')
          .eq('id', order_id)
          .single();

        if (fetchOrderError || !orderToCancel) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Order not found' })
          };
        }

        if (orderToCancel.user_id !== authUser.id) {
          return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Not your order' })
          };
        }

        // Check 24-hour window
        const orderAge = Date.now() - new Date(orderToCancel.created_at).getTime();
        if (orderAge > 24 * 60 * 60 * 1000) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Cancellation window has closed (24 hours passed)' })
          };
        }

        if (orderToCancel.status === 'cancelled') {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Order is already cancelled' })
          };
        }

        const { error: cancelError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', order_id);

        if (cancelError) throw cancelError;
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Order cancelled successfully' })
        };
      }
    }

    // 3. --- PROTECTED ACTIONS (Admin Only) ---
    if (!authToken) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Verify user via token
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
    if (authError || !user) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid Session' })
      };
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden: Admins only' })
      };
    }

    // --- ADMIN GET ACTIONS ---
    if (method === 'GET' && action === 'orders') {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orders)
      };
    }

    // 3. --- ADMIN WRITE ACTIONS (POST, PUT, DELETE) ---
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      const body = event.body ? JSON.parse(event.body) : {};

      if (method === 'POST') { // Create or Action

        if (action === 'update-order-status') {
          const { order_id, status } = body;

          if (!order_id || !status) {
            return { statusCode: 400, body: JSON.stringify({ error: 'order_id and status are required' }) };
          }

          // Update the order status
          const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update({ status: status })
            .eq('id', order_id)
            .select(`
              *,
              order_items (
                product_id,
                products (name)
              )
            `)
            .single();

          if (updateError) throw updateError;

          // If delivered, send automated review email
          if (status === 'delivered' && updatedOrder.customer_email) {
            try {
              // Create review links for each item (or just the first one)
              const reviewHtml = updatedOrder.order_items.map(item => {
                const prodName = item.products?.name || 'Your Product';
                const reviewLink = `${event.headers.origin || 'http://localhost:8888'}/catalog.html?search=${encodeURIComponent(prodName)}&review_product_id=${item.product_id}`;
                return `<li><a href="${reviewLink}">Review ${prodName}</a></li>`;
              }).join('');

              const mailOptions = {
                from: process.env.EMAIL_USER,
                to: updatedOrder.customer_email,
                subject: 'Your order has been delivered! Please leave a review.',
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #004a7c;">Order Delivered!</h2>
                    <p>Hi ${updatedOrder.customer_name || 'Customer'},</p>
                    <p>Great news! Your recent order (#${updatedOrder.id}) from SecondWare has been successfully delivered.</p>
                    <p>We'd love to hear your thoughts on the products you purchased. Your feedback helps us improve and helps other customers make great choices.</p>
                    <h3 style="color: #4CAF50;">Click below to leave a review:</h3>
                    <ul>
                      ${reviewHtml}
                    </ul>
                    <p>Thank you for shopping with SecondWare!</p>
                  </div>
                `
              };

              // Only attempt sending if EMAIL_USER is configured
              if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                await transporter.sendMail(mailOptions);
              } else {
                console.warn('Email credentials not configured. Email not sent.');
              }
            } catch (emailError) {
              console.error('Failed to send review email:', emailError);
              // Don't fail the request if email fails
            }
          }

          return { statusCode: 200, body: JSON.stringify(updatedOrder) };
        }

        let imageUrls = [];

        // Upload Images to Supabase Storage if provided
        if (body.images && Array.isArray(body.images)) {
          for (let i = 0; i < body.images.length; i++) {
            const timestamp = Date.now();
            const fileName = `product_${timestamp}_${i}.jpg`;
            const base64Data = body.images[i].split(',')[1] || body.images[i];

            const { data: uploadData, error: uploadError } = await supabase
              .storage
              .from('product-images')
              .upload(fileName, decode(base64Data), { contentType: 'image/jpeg' });

            if (!uploadError) {
              const { data: publicUrlData } = supabase
                .storage
                .from('product-images')
                .getPublicUrl(fileName);
              imageUrls.push(publicUrlData.publicUrl);
            } else {
              console.error("Storage Error for image", i, uploadError);
            }
          }
        } else if (body.image) {
          // Legacy single image fallback
          const timestamp = Date.now();
          const fileName = `product_${timestamp}.jpg`;
          const base64Data = body.image.split(',')[1] || body.image;
          const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, decode(base64Data), { contentType: 'image/jpeg' });
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
            imageUrls.push(publicUrlData.publicUrl);
          }
        }

        const productData = {
          name: typeof body.name === 'string' ? body.name.substring(0, 255) : 'Unnamed Product',
          price: parseFloat(body.price) || 0,
          stock_quantity: parseInt(body.stock_quantity) || 0,
          description: typeof body.description === 'string' ? body.description.substring(0, 500) : '',
          image_url: imageUrls.length > 0 ? imageUrls[0] : null,
          image_urls: imageUrls,
          category: Array.isArray(body.category) ? body.category : [body.category]
        };

        const { data, error } = await supabase.from('products').insert([productData]).select();
        if (error) throw error;
        return { statusCode: 201, body: JSON.stringify(data) };
      }

      if (method === 'DELETE') { // Delete
        // First, get the product to find its image URL
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('image_url')
          .eq('id', body.id)
          .single();

        if (fetchError) throw fetchError;

        // Delete image from storage if it exists
        if (product && product.image_url) {
          try {
            // Extract filename from the public URL
            const fileName = product.image_url.split('/').pop();
            if (fileName) {
              await supabase
                .storage
                .from('product-images')
                .remove([fileName]);
            }
          } catch (storageError) {
            console.error("Storage deletion error:", storageError);
            // Continue with product deletion even if storage deletion fails
          }
        }

        // Delete product record from database
        const { error } = await supabase.from('products').delete().eq('id', body.id);
        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify({ message: 'Product and image deleted successfully' }) };
      }

      if (method === 'PUT') { // Update
        const { id, ...updateData } = body;

        if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Product ID is required for update' }) };

        let imageUrls = undefined;
        let mainImageUrl = undefined;

        // Handle images update if provided
        if (updateData.images && Array.isArray(updateData.images)) {
          imageUrls = [];
          for (let i = 0; i < updateData.images.length; i++) {
            const timestamp = Date.now();
            const fileName = `product_${timestamp}_${i}.jpg`;
            const base64Data = updateData.images[i].split(',')[1] || updateData.images[i];

            const { error: uploadError } = await supabase
              .storage
              .from('product-images')
              .upload(fileName, decode(base64Data), { contentType: 'image/jpeg' });

            if (!uploadError) {
              const { data: publicUrlData } = supabase
                .storage
                .from('product-images')
                .getPublicUrl(fileName);
              imageUrls.push(publicUrlData.publicUrl);
            }
          }
          if (imageUrls.length > 0) {
            mainImageUrl = imageUrls[0];
          }
        } else if (updateData.image) {
          // Legacy single image fallback
          const timestamp = Date.now();
          const fileName = `product_${timestamp}.jpg`;
          const base64Data = updateData.image.split(',')[1] || updateData.image;
          const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, decode(base64Data), { contentType: 'image/jpeg' });
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
            mainImageUrl = publicUrlData.publicUrl;
            imageUrls = [mainImageUrl];
          }
        }

        const cleanUpdateData = {
          name: typeof updateData.name === 'string' ? updateData.name.substring(0, 255) : undefined,
          price: updateData.price ? parseFloat(updateData.price) : undefined,
          stock_quantity: updateData.stock_quantity !== undefined ? parseInt(updateData.stock_quantity) : undefined,
          description: typeof updateData.description === 'string' ? updateData.description.substring(0, 500) : undefined,
          category: updateData.category,
          image_url: mainImageUrl,
          image_urls: imageUrls
        };

        // Remove undefined fields
        Object.keys(cleanUpdateData).forEach(key => cleanUpdateData[key] === undefined && delete cleanUpdateData[key]);

        const { data, error } = await supabase
          .from('products')
          .update(cleanUpdateData)
          .eq('id', id)
          .select();

        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify(data) };
      }
    }

  } catch (error) {
    console.error('API Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};