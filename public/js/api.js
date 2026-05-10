const API_URL = '/api/auth';

async function sendOtp(email) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-otp', email })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to send OTP');
    return data;
}

async function verifyOtp(email, otp) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-otp', email, otp })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to verify OTP');
    return data;
}

async function registerUser(email, password) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'signup', email, password })
    });

    const data = await response.json();

    if (response.ok) {
        alert('Verification code sent! Please check your email.');
        return { success: true };
    } else {
        const errorMsg = data.error || 'Registration initiation failed';
        return { success: false, error: errorMsg };
    }
}

async function verifySignup(email, otp) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-otp', email, otp })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to verify signup');
    return data;
}

async function initiateGoogleLogin() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'google-login' })
        });

        const data = await response.json();
        if (response.ok && data.url) {
            window.location.href = data.url;
        } else {
            const errorMsg = data.error || 'Failed to initiate login. Please check server logs.';
            alert('Google Login error: ' + errorMsg);
        }
    } catch (error) {
        console.error('Google Login error:', error);
        alert('Error: ' + error.message);
    }
}

async function finalizeLoginWithCode(code) {
    if (!code) return;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'exchange-code', token: code })
        });

        const data = await response.json();

        if (response.ok && data.token) {
            sessionStorage.setItem('auth_token', data.token);
            sessionStorage.setItem('user_role', data.role || 'user');
            sessionStorage.setItem('user_id', data.user.id);
            sessionStorage.setItem('user_email', data.user.email);
            if (data.upi_id) sessionStorage.setItem('upi_id', data.upi_id);
            if (data.upi_qr_url) sessionStorage.setItem('upi_qr_url', data.upi_qr_url);

            // Redirect to home or referrer
            const referrer = sessionStorage.getItem('login_referrer');
            sessionStorage.removeItem('login_referrer');
            window.location.href = referrer || 'index.html';
        } else {
            console.error('Failed to exchange code:', data.error);
            alert('Login failed: ' + (data.error || 'Unknown error'));
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Exchange code error:', error);
        alert('Error completing login: ' + error.message);
        window.location.href = 'login.html';
    }
}

async function finalizeGoogleLogin(token) {
    if (!token) return;

    try {
        console.log('[Auth] Finalizing Google Login with token...');
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-user-details', token })
        });

        const data = await response.json();

        if (response.ok && data.user) {
            console.log('[Auth] Login successful! User:', data.user.email);
            // Store the JWT token from our backend (data.token) if available, otherwise fallback to input token
            const sessionToken = data.token || token;
            sessionStorage.setItem('auth_token', sessionToken);
            sessionStorage.setItem('user_role', data.role || 'user');
            sessionStorage.setItem('user_id', data.user.id);
            sessionStorage.setItem('user_email', data.user.email);
            if (data.upi_id) sessionStorage.setItem('upi_id', data.upi_id);
            if (data.upi_qr_url) sessionStorage.setItem('upi_qr_url', data.upi_qr_url);

            // Re-initialize UI
            if (typeof initializeAdminVisibility === 'function') initializeAdminVisibility();

            // Redirect to home or referrer
            const referrer = sessionStorage.getItem('login_referrer');
            sessionStorage.removeItem('login_referrer');
            
            console.log('[Auth] Redirecting to:', referrer || 'index.html');
            window.location.href = referrer || 'index.html';
        } else {
            console.error('[Auth] Backend rejected session:', data.error);
            alert('Login failed: ' + (data.error || 'The session is invalid or expired. Please try again.'));
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('[Auth] Finalize error:', error);
        alert('Error completing login: ' + error.message);
        window.location.href = 'login.html';
    }
}
async function loginUser(email, password) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'login', email, password })
        });

        const text = await response.text();
        console.log('Response status:', response.status);
        console.log('Response text:', text);

        let data;
        if (text) {
            try {
                data = JSON.parse(text);
                if (pendingApps.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No requests found.</p>';
                    return;
                }
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                alert('Error: Could not retrieve merchant applications');
                return;
            }
        } else {
            alert('Error: Empty response from server');
            return;
        }

        if (response.ok && data.token) {
            // Store the JWT token securely (SessionStorage or a cookie)
            sessionStorage.setItem('auth_token', data.token);
            if (data.role) sessionStorage.setItem('user_role', data.role);
            sessionStorage.setItem('user_id', data.user.id);
            sessionStorage.setItem('user_email', email);

            // Check if there's a referrer page to redirect to
            const referrer = sessionStorage.getItem('login_referrer');
            sessionStorage.removeItem('login_referrer'); // Clear the referrer after use

            if (referrer) {
                // Redirect to the page that referred to login
                window.location.href = referrer;
            } else if (data.role === 'admin') {
                // Fallback: redirect based on role
                window.location.href = 'admin/admin.html';
            } else {
                window.location.href = 'index.html';
            }
        } else {
            alert('Error: ' + (data.error || 'Login failed'));
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Error: ' + error.message);
    }
}

// Logout user and clear session
function logoutUser() {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_role');
    sessionStorage.removeItem('user_email');
    window.location.href = 'index.html';
}

// Show/Hide admin-only elements and toggle Login/Logout
function initializeAdminVisibility() {
    const token = sessionStorage.getItem('auth_token');
    const role = sessionStorage.getItem('user_role');

    // 1. Handle Admin/Merchant visibility
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        if (role === 'admin' || role === 'merchant') {
            el.style.display = '';
            el.removeAttribute('hidden');
            
            // Dynamically set link to the correct panel
            if (el.tagName === 'A' && el.textContent.trim().toLowerCase().includes('admin')) {
                el.href = role === 'admin' ? 'admin/super-admin.html' : 'admin/admin.html';
            }
        } else {
            el.style.display = 'none';
            el.setAttribute('hidden', '');
        }
    });

    // 1b. Handle Super-Admin only visibility
    const superAdminElements = document.querySelectorAll('.super-admin-only');
    superAdminElements.forEach(el => {
        if (role === 'admin') {
            el.style.display = '';
            el.removeAttribute('hidden');
        } else {
            el.style.display = 'none';
            el.setAttribute('hidden', '');
        }
    });

    // 1c. Handle Logged-in only visibility
    const loggedInElements = document.querySelectorAll('.logged-in-only');
    loggedInElements.forEach(el => {
        if (token) {
            el.style.display = '';
            el.removeAttribute('hidden');
        } else {
            el.style.display = 'none';
            el.setAttribute('hidden', '');
        }
    });

    // 2. Handle Login/Logout toggle
    const authLinks = document.querySelectorAll('#auth-link, .panel-item[href="login.html"], .panel-item[onclick*="logoutUser"]');
    authLinks.forEach(link => {
        if (token) {
            link.textContent = 'Logout';
            link.href = '#';
            link.onclick = (e) => {
                e.preventDefault();
                logoutUser();
            };
        } else {
            link.textContent = 'Login';
            link.href = 'login.html';
            link.onclick = null;
        }
    });
}

function checkAdminOrRedirect() {
    const token = sessionStorage.getItem('auth_token');
    const role = sessionStorage.getItem('user_role');

    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    if (role !== 'admin' && role !== 'merchant') {
        alert("Access Denied. Admin or Merchant privileges required.");
        sessionStorage.clear();
        window.location.href = '/login.html';
    }
}

function checkSuperAdminOrRedirect() {
    const token = sessionStorage.getItem('auth_token');
    const role = sessionStorage.getItem('user_role');

    if (!token || role !== 'admin') {
        alert("Access Denied. Super Admin privileges required.");
        window.location.href = '/login.html';
    }
}

// Check admin access when clicking Admin button - verifies with Supabase
async function checkAdminAccessAndRedirect() {
    const token = sessionStorage.getItem('auth_token');

    // Check if user is logged in
    if (!token) {
        // Not logged in, redirect to login
        window.location.href = 'login.html';
        return;
    }

    // User is logged in, verify admin role from Supabase
    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'verify-admin',
                token: token
            })
        });

        const data = await response.json();

        if (response.ok && (data.role === 'admin' || data.role === 'merchant')) {
            // User is admin or merchant, allow access
            const target = data.role === 'admin' ? 'admin/super-admin.html' : 'admin/admin.html';
            window.location.href = target;
        } else {
            // User is logged in but not admin
            alert("Access Denied. Admin privileges required.");
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Admin verification error:', error);
        alert('Error verifying admin status. Please try again.');
        window.location.href = 'login.html';
    }
}
// Get all products to display on the store
async function fetchAllProducts(merchantId = null) {
    try {
        let url = '/api/products';
        if (merchantId) url += `?merchant_id=${encodeURIComponent(merchantId)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `API error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch products:', error);
        throw error;
    }
}

// Get all orders (Admin Only)
async function fetchAllOrders() {
    const token = sessionStorage.getItem('auth_token');
    const response = await fetch('/api/products?action=orders', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch orders');
    }
    return await response.json();
}

// Get a single product by ID
async function fetchProductById(id, merchantId = null) {
    const products = await fetchAllProducts(merchantId);
    return products.find(p => p.id == id);
}

// Add a new product (Only works if logged in as Admin)
async function adminAddProduct(name, price, stock, description, rating, imagesBase64, category, colors = []) {
    const token = sessionStorage.getItem('auth_token'); // Saved during login

    const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name,
            price,
            stock_quantity: stock,
            description,
            rating,
            images: imagesBase64,
            category,
            colors
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add product');
    }

    return await response.json();
}

// Update an existing product (Only works if logged in as Admin)
async function adminUpdateProduct(id, name, price, stock, description, rating, imagesBase64, category, colors = []) {
    const token = sessionStorage.getItem('auth_token');

    const body = { id, name, price, stock_quantity: stock, description, rating, category, colors };
    if (imagesBase64 && imagesBase64.length > 0) body.images = imagesBase64;

    const response = await fetch('/api/products', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update product');
    }

    return await response.json();
}

// Update order status (Admin Only)
async function adminUpdateOrderStatus(orderId, status) {
    const token = sessionStorage.getItem('auth_token');
    const response = await fetch('/api/products?action=update-order-status', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order_id: orderId, status })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update order status');
    }

    return await response.json();
}
// Simple Cart Logic
function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '[]');
}

// --- Delivery Fee Configuration (Nagpur Only) ---
const NAGPUR_AREA_FEE_MAP = {
    'Wadi': 200,
    'Dharampeth': 350,
    'Sadar': 350,
    'Sitabuldi': 350,
    'Manish Nagar': 450,
    'Besa': 500,
    'Khamla': 350,
    'Trimurti Nagar': 300,
    'Hingna': 300,
    'Butibori': 850,
    'Kamptee': 850,
    'Others (Nagpur)': 600
};

const CATEGORY_BULK_FACTORS = {
    'Refrigerators': 2.5,
    'Washing Machines': 2.0,
    'Air Conditioners': 2.0,
    'Televisions': 1.5,
    'Microwaves': 1.2,
    'Accessories': 1.0,
    'Others': 1.0
};

function calculateDeliveryFee(area, items) {
    if (!area) return 0;

    const baseFee = NAGPUR_AREA_FEE_MAP[area] || NAGPUR_AREA_FEE_MAP['Others (Nagpur)'];
    let maxFactor = 1.0;

    items.forEach(item => {
        // Handle items from catalog (item.category might be array or string)
        const categories = Array.isArray(item.category) ? item.category : [item.category];
        categories.forEach(cat => {
            const factor = CATEGORY_BULK_FACTORS[cat] || CATEGORY_BULK_FACTORS['Others'];
            if (factor > maxFactor) maxFactor = factor;
        });
    });

    return Math.round(baseFee * maxFactor);
}

// Payment Gateway configuration is now handled directly via Razorpay in checkout logic

// Delete unpaid order (Admin only)
async function deleteUnpaidOrder(orderId) {
    const token = sessionStorage.getItem('auth_token');
    const response = await fetch('/api/products?action=delete-unpaid-order', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order_id: orderId })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete order');
    }
    return await response.json();
}

// Admin: toggle processed status for an order (persists to DB)
async function adminToggleProcessed(orderId, processed) {
    const token = sessionStorage.getItem('auth_token');
    const response = await fetch('/api/products?action=update-processed-status', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order_id: orderId, processed })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update processed status');
    }
    return await response.json();
}

// Merchant Application Management
async function listMerchantApplications() {
    const token = sessionStorage.getItem('auth_token');
    const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'list-merchant-applications' })
    });
    if (!response.ok) throw new Error('No requests found');
    return await response.json();
}

async function approveMerchant(appId, userId) {
    const token = sessionStorage.getItem('auth_token');
    const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'approve-merchant', application_id: appId, user_id: userId })
    });
    if (!response.ok) throw new Error('Failed to approve merchant');
    return await response.json();
}

async function rejectMerchant(appId) {
    const token = sessionStorage.getItem('auth_token');
    const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'reject-merchant', application_id: appId })
    });
    if (!response.ok) throw new Error('Failed to reject merchant');
    return await response.json();
}

async function updatePayoutInfo(upiId, upiQrBase64) {
    const token = sessionStorage.getItem('auth_token');
    const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'update-payout-info', upi_id: upiId, upi_qr_base64: upiQrBase64 })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update payout info');
    }
    const data = await response.json();
    if (data.upi_qr_url) sessionStorage.setItem('upi_qr_url', data.upi_qr_url);
    sessionStorage.setItem('upi_id', upiId);
    return data;
}
