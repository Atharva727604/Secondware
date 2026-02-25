const { createClient } = require('@supabase/supabase-js');
const { decode } = require('base64-arraybuffer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const method = event.httpMethod;
  const { action } = event.queryStringParameters || {};
  const authToken = event.headers.authorization?.replace('Bearer ', '');

  try {
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

      if (method === 'POST') { // Create
        let imageUrl = null;

        // Upload Image to Supabase Storage if provided
        if (body.image) {
          const timestamp = Date.now();
          const fileName = `product_${timestamp}.jpg`; // Assuming jpg for now or generic extension

          // Decode base64 image
          // 'body.image' should be the base64 string without data:image/png;base64, prefix
          // We'll strip it just in case
          const base64Data = body.image.split(',')[1] || body.image;

          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('product-images')
            .upload(fileName, decode(base64Data), {
              contentType: 'image/jpeg'
            });

          if (uploadError) {
            console.error("Storage Error:", uploadError);
            // Don't fail the whole request, just log it. Product will have no image.
          } else {
            // Get Public URL
            const { data: publicUrlData } = supabase
              .storage
              .from('product-images')
              .getPublicUrl(fileName);

            imageUrl = publicUrlData.publicUrl;
          }
        }

        const productData = {
          name: typeof body.name === 'string' ? body.name.substring(0, 100) : 'Unnamed Product',
          price: parseFloat(body.price) || 0,
          stock_quantity: parseInt(body.stock_quantity) || 0,
          description: typeof body.description === 'string' ? body.description.substring(0, 500) : '',
          image_url: imageUrl,
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

        // Handle image update if provided
        if (updateData.image) {
          // 1. Get old product to check for existing image
          const { data: oldProduct } = await supabase
            .from('products')
            .select('image_url')
            .eq('id', id)
            .single();

          // 2. Upload new image
          const timestamp = Date.now();
          const fileName = `product_${timestamp}.jpg`;
          const base64Data = updateData.image.split(',')[1] || updateData.image;

          const { error: uploadError } = await supabase
            .storage
            .from('product-images')
            .upload(fileName, decode(base64Data), {
              contentType: 'image/jpeg'
            });

          if (!uploadError) {
            // 3. Delete old image if it exists
            if (oldProduct?.image_url) {
              const oldFileName = oldProduct.image_url.split('/').pop();
              await supabase.storage.from('product-images').remove([oldFileName]);
            }

            // 4. Update image_url in updateData
            const { data: publicUrlData } = supabase
              .storage
              .from('product-images')
              .getPublicUrl(fileName);

            updateData.image_url = publicUrlData.publicUrl;
          }

          // Remove the base64 image string before DB update
          delete updateData.image;
        }

        const cleanUpdateData = {
          name: typeof updateData.name === 'string' ? updateData.name.substring(0, 100) : undefined,
          price: updateData.price ? parseFloat(updateData.price) : undefined,
          stock_quantity: updateData.stock_quantity !== undefined ? parseInt(updateData.stock_quantity) : undefined,
          description: typeof updateData.description === 'string' ? updateData.description.substring(0, 500) : undefined,
          category: updateData.category,
          image_url: updateData.image_url
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