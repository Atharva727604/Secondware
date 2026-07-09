const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase environment variables missing');
  }
  return createClient(url, key);
}

exports.handler = async (event) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { messages } = JSON.parse(event.body || '{}');
    if (!messages || !Array.isArray(messages)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid messages payload' })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Gemini API key is not configured on the server' })
      };
    }

    // Fetch product catalog for system instructions
    let productsListText = 'No products in catalog currently.';
    try {
      const supabase = getSupabaseClient();
      const { data: products, error } = await supabase
        .from('products')
        .select('name, price, stock_quantity, description, category');
      
      if (!error && products && products.length > 0) {
        productsListText = products.map(p => 
          `- Name: ${p.name}\n  Price: ₹${p.price.toLocaleString('en-IN')}\n  Category: ${Array.isArray(p.category) ? p.category.join(', ') : p.category}\n  Stock Status: ${p.stock_quantity > 0 ? `In Stock (${p.stock_quantity} available)` : 'Out of Stock'}\n  Description: ${p.description || 'N/A'}`
        ).join('\n\n');
      }
    } catch (dbError) {
      console.error('Failed to fetch products for chat context:', dbError);
      // Proceed without products context if DB is down
    }

    // System instruction for the assistant
    const systemInstruction = `You are "Warey", the official AI Chatbot Assistant for SecondWare, a premium warehouse-surplus store selling high-quality home appliances (fridges, washing machines, ACs, TVs, etc.) at less than half the market price.
We operate exclusively in the Nagpur region, Maharashtra, India. Our base location is Wadi, Nagpur.

Key Store Policies & Information:
1. Warranty:
   - 1-Year Comprehensive Warranty on standard electrical components and products.
   - 3-Year Compressor Warranty on refrigeration units and air conditioners.
   Note: Since these are warehouse-surplus items, original manufacturer warranty is void, but we back them with our local warranties.
2. Delivery & Nagpur Areas:
   - We deliver ONLY in the Nagpur region.
   - Areas and base delivery fees: Wadi (₹200), Dharampeth (₹350), Sadar (₹350), Sitabuldi (₹350), Khamla (₹350), Trimurti Nagar (₹300), Hingna (₹300), Manish Nagar (₹450), Besa (₹500), Butibori (₹850), Kamptee (₹850), Others (Nagpur) (₹600).
   - Category bulk factors multiply the delivery fee: Refrigerators (2.5x), Washing Machines (2x), ACs (2x), TVs (1.5x), Microwaves (1.2x), Accessories/Others (1x). The final fee is (Base Area Fee * Maximum Bulk Factor of item in cart).
3. Returns & Cancellations:
   - Orders can only be cancelled within 24 hours of placing.
   - No returns for "change of mind" or minor cosmetic marks (disclosed at purchase).
   - If a product has a functional defect upon installation/delivery, we offer immediate replacement or repair.
4. Contact Details:
   - Address: Plot no.12, Adarsh Nagar, Wadi, Nagpur-440023, Maharashtra, India
   - Phone: +91 9923414522
   - Email: atharvaenterprises2027@gmail.com

Product Catalog:
${productsListText}

Instructions for your responses:
- Introduce yourself warmly as Warey from SecondWare.
- Help customers browse the catalog, compare items, understand pricing, and clarify warranty/delivery rules.
- Only suggest products that exist in the product catalog listed above.
- Be polite, helpful, and concise. Avoid long-winded answers. Keep responses under 3 short paragraphs unless listing options.
- Formatting: Use bold text for product names and bullet points for lists to make them highly readable. Use INR symbol (₹) for pricing.`;

    // Make the API call to Gemini 2.5 Flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    // Map client conversation format to Gemini API format, ensuring they have role and parts
    const contents = messages.map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: Array.isArray(m.parts) ? m.parts : [{ text: m.content || m.text }]
    }));

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API returned error: ${response.status} - ${errorText}`);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Gemini API error: ${response.status}` })
      };
    }

    const data = await response.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: replyText })
    };

  } catch (error) {
    console.error('Error in chat netlify function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
