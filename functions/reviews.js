const { createClient } = require('@supabase/supabase-js');
const { decode } = require('base64-arraybuffer');

function getSupabaseClient(authToken) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase environment variables missing');
    const options = authToken ? { global: { headers: { Authorization: `Bearer ${authToken}` } } } : {};
    return createClient(url, key, options);
}

exports.handler = async (event) => {
    const method = event.httpMethod;
    const { product_id } = event.queryStringParameters || {};
    const authToken = event.headers.authorization?.replace('Bearer ', '');

    try {
        const supabase = getSupabaseClient(authToken);
        // GET: Fetch reviews for a specific product
        if (method === 'GET') {
            if (!product_id) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'product_id is required' })
                };
            }

            const { data, error } = await supabase
                .from('reviews')
                .select(`
          id,
          rating,
          comment,
          image_url,
          created_at,
          profiles (
            email
          )
        `)
                .eq('product_id', product_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            };
        }

        // POST: Submit a new review
        if (method === 'POST') {
            if (!authToken) {
                return {
                    statusCode: 401,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Unauthorized' })
                };
            }

            // Verify user token
            const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
            if (authError || !user) {
                return {
                    statusCode: 401,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Invalid Session' })
                };
            }

            const body = event.body ? JSON.parse(event.body) : {};
            const prodId = parseInt(body.product_id);
            const rating = parseFloat(body.rating);
            const comment = typeof body.comment === 'string' ? body.comment.substring(0, 1000) : null;
            let imageUrl = null;

            if (!prodId || isNaN(rating) || rating < 1 || rating > 5) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Valid product_id and rating (1-5) are required' })
                };
            }

            // Handle Image Upload if provided
            if (body.image) {
                const timestamp = Date.now();
                const fileName = `review_${user.id}_${timestamp}.jpg`;
                const base64Data = body.image.split(',')[1] || body.image;

                const { data: uploadData, error: uploadError } = await supabase
                    .storage
                    .from('review-images') // Assuming the bucket is named 'review-images'
                    .upload(fileName, decode(base64Data), {
                        contentType: 'image/jpeg'
                    });

                if (!uploadError) {
                    const { data: publicUrlData } = supabase
                        .storage
                        .from('review-images')
                        .getPublicUrl(fileName);
                    imageUrl = publicUrlData.publicUrl;
                } else {
                    console.error("Storage Error for Review Image: ", uploadError);
                }
            }

            // Insert Review
            const { data: newReview, error: insertError } = await supabase
                .from('reviews')
                .insert([{
                    product_id: prodId,
                    user_id: user.id,
                    rating: rating,
                    comment: comment,
                    image_url: imageUrl
                }])
                .select(`
          id,
          rating,
          comment,
          image_url,
          created_at,
          profiles (
            email
          )
        `)
                .single();

            if (insertError) {
                // If unique constraint violation (user already reviewed this product)
                if (insertError.code === '23505') {
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'You have already reviewed this product.' })
                    };
                }
                throw insertError;
            }

            return {
                statusCode: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newReview)
            };
        }

        // Method Not Allowed
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };

    } catch (error) {
        console.error('API Error in reviews.js:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
