const API_URL = '/api/auth';

// --- Authentication Session Storage Helpers ---
function setAuthSession(data) {
    if (!data) return;
    const token = data.token;
    const role = data.role || 'user';
    const userId = data.id || (data.user && data.user.id) || '';
    const userEmail = data.email || (data.user && data.user.email) || '';
    const upiId = data.upi_id || '';
    const upiQrUrl = data.upi_qr_url || '';

    // Extract avatar url from backend or Supabase user metadata (Google OAuth)
    const avatarUrl = data.avatar_url || 
        (data.user && (
            data.user.user_metadata?.avatar_url || 
            data.user.user_metadata?.picture || 
            (data.user.identities && data.user.identities[0]?.identity_data?.avatar_url) ||
            (data.user.identities && data.user.identities[0]?.identity_data?.picture)
        )) || '';

    // Extract user full name from backend or metadata
    const userName = data.name ||
        (data.user && (
            data.user.user_metadata?.full_name || 
            data.user.user_metadata?.name || 
            (data.user.identities && data.user.identities[0]?.identity_data?.full_name) ||
            (data.user.identities && data.user.identities[0]?.identity_data?.name)
        )) || '';

    if (token) {
        localStorage.setItem('auth_token', token);
        sessionStorage.setItem('auth_token', token);
    }
    localStorage.setItem('user_role', role);
    sessionStorage.setItem('user_role', role);

    if (userId) {
        localStorage.setItem('user_id', userId);
        sessionStorage.setItem('user_id', userId);
    }
    if (userEmail) {
        localStorage.setItem('user_email', userEmail);
        sessionStorage.setItem('user_email', userEmail);
    }
    if (avatarUrl) {
        localStorage.setItem('user_avatar', avatarUrl);
        sessionStorage.setItem('user_avatar', avatarUrl);
    }
    if (userName) {
        localStorage.setItem('user_name', userName);
        sessionStorage.setItem('user_name', userName);
    }
    if (upiId) {
        localStorage.setItem('upi_id', upiId);
        sessionStorage.setItem('upi_id', upiId);
    }
    if (upiQrUrl) {
        localStorage.setItem('upi_qr_url', upiQrUrl);
        sessionStorage.setItem('upi_qr_url', upiQrUrl);
    }
}

function getAuthToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function getUserRole() {
    return localStorage.getItem('user_role') || sessionStorage.getItem('user_role') || 'user';
}

function getUserEmail() {
    return localStorage.getItem('user_email') || sessionStorage.getItem('user_email');
}

function getUserAvatar() {
    return localStorage.getItem('user_avatar') || sessionStorage.getItem('user_avatar') || '';
}

function getUserName() {
    return localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';
}

function getUserId() {
    return localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
}

function getUpiId() {
    return localStorage.getItem('upi_id') || sessionStorage.getItem('upi_id');
}

function getUpiQrUrl() {
    return localStorage.getItem('upi_qr_url') || sessionStorage.getItem('upi_qr_url');
}

function clearAuthSession() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_avatar');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_avatar_checked');
    localStorage.removeItem('upi_id');
    localStorage.removeItem('upi_qr_url');

    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_role');
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('user_email');
    sessionStorage.removeItem('user_avatar');
    sessionStorage.removeItem('user_name');
    sessionStorage.removeItem('user_avatar_checked');
    sessionStorage.removeItem('upi_id');
    sessionStorage.removeItem('upi_qr_url');
}

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
            setAuthSession({
                token: data.token,
                role: data.role || 'user',
                id: data.user ? data.user.id : '',
                email: data.user ? data.user.email : '',
                avatar_url: data.avatar_url,
                name: data.name,
                user: data.user,
                upi_id: data.upi_id,
                upi_qr_url: data.upi_qr_url
            });

            if (typeof initializeAdminVisibility === 'function') initializeAdminVisibility();

            // Redirect to home or referrer
            const referrer = localStorage.getItem('login_referrer') || sessionStorage.getItem('login_referrer');
            localStorage.removeItem('login_referrer');
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
            const sessionToken = data.token || token;
            setAuthSession({
                token: sessionToken,
                role: data.role || 'user',
                id: data.user.id,
                email: data.user.email,
                avatar_url: data.avatar_url,
                name: data.name,
                user: data.user,
                upi_id: data.upi_id,
                upi_qr_url: data.upi_qr_url
            });

            // Re-initialize UI
            if (typeof initializeAdminVisibility === 'function') initializeAdminVisibility();

            // Redirect to home or referrer
            const referrer = localStorage.getItem('login_referrer') || sessionStorage.getItem('login_referrer');
            localStorage.removeItem('login_referrer');
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
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                alert('Error: Invalid response from server');
                return;
            }
        } else {
            alert('Error: Empty response from server');
            return;
        }

        if (response.ok && data.token) {
            setAuthSession({
                token: data.token,
                role: data.role,
                id: data.user ? data.user.id : '',
                email: email,
                avatar_url: data.avatar_url,
                name: data.name,
                user: data.user
            });

            const referrer = localStorage.getItem('login_referrer') || sessionStorage.getItem('login_referrer');
            localStorage.removeItem('login_referrer');
            sessionStorage.removeItem('login_referrer');

            if (referrer) {
                window.location.href = referrer;
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
    clearAuthSession();
    window.location.href = 'index.html';
}

// Show/Hide logged-in only elements and toggle Login/Profile Icon
function initializeAdminVisibility() {
    const token = getAuthToken();

    // 1. Hide any legacy admin elements if present
    document.querySelectorAll('.admin-only, .super-admin-only, .merchant-only').forEach(el => {
        el.style.display = 'none';
        el.setAttribute('hidden', '');
    });

    // 2. Handle Logged-in only visibility
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

    // 3. Handle Login button -> Profile Icon Component conversion
    renderUserProfileComponent(token);

    // 4. Background fetch user details if user logged in but avatar is not yet cached
    if (token && !localStorage.getItem('user_avatar_checked')) {
        localStorage.setItem('user_avatar_checked', '1');
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-user-details', token })
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.user) {
                setAuthSession(data);
                const updatedAvatar = getUserAvatar();
                const updatedName = getUserName();
                if (updatedAvatar || updatedName) {
                    renderUserProfileComponent(token);
                }
            }
        })
        .catch(err => console.warn('Could not refresh user avatar:', err));
    }
}

// Render Profile Icon button with dropdown when logged in, or standard Login button when logged out
function renderUserProfileComponent(token) {
    const loginUrl = 'login.html';
    const settingsUrl = 'settings.html';
    const catalogUrl = 'catalog.html';

    const authTargets = document.querySelectorAll('#auth-link, #nav-login-link');
    const userEmail = getUserEmail() || '';
    const userName = getUserName() || (userEmail ? userEmail.split('@')[0] : 'User');
    const avatarUrl = getUserAvatar() || '';

    authTargets.forEach(target => {
        if (!token) {
            // Logged out: render simple Login button
            if (target.classList.contains('user-profile-menu-wrapper')) {
                // Was converted to profile wrapper previously; revert to link
                const isNavBtn = target.dataset.originalClass === 'login-btn';
                const newLink = document.createElement('a');
                newLink.id = target.dataset.originalId || 'auth-link';
                newLink.href = loginUrl;
                newLink.className = isNavBtn ? 'login-btn' : 'btn btn-outline';
                newLink.textContent = 'Log in';
                target.parentNode.replaceChild(newLink, target);
            } else {
                target.textContent = 'Log in';
                target.href = loginUrl;
                target.onclick = null;
            }
            return;
        }

        // Logged in: replace target with sleek Profile Button & Dropdown
        const originalId = target.id || 'auth-link';
        const originalClass = target.classList.contains('login-btn') ? 'login-btn' : 'btn-outline';

        // Create or update wrapper
        let wrapper = target;
        if (!target.classList.contains('user-profile-menu-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'user-profile-menu-wrapper';
            wrapper.dataset.originalId = originalId;
            wrapper.dataset.originalClass = originalClass;
            target.parentNode.replaceChild(wrapper, target);
        }

        wrapper.innerHTML = `
            <button type="button" class="user-profile-btn" id="user-profile-btn" aria-label="Open profile menu" aria-expanded="false">
                ${avatarUrl ? `
                    <img src="${avatarUrl}" alt="Profile" class="user-profile-img" referrerpolicy="no-referrer" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                    <span class="user-profile-default-icon" style="display:none;">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </span>
                ` : `
                    <span class="user-profile-default-icon" style="display:flex;">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </span>
                `}
            </button>
            <div class="user-profile-dropdown" id="user-profile-dropdown" aria-hidden="true">
                <div class="dropdown-user-header">
                    <div class="dropdown-avatar-circle">
                        ${avatarUrl ? `
                            <img src="${avatarUrl}" alt="Profile" referrerpolicy="no-referrer" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                            <span style="display:none;"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
                        ` : `
                            <span><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
                        `}
                    </div>
                    <div class="dropdown-user-meta">
                        <span class="dropdown-user-name">${userName}</span>
                        <span class="dropdown-user-email" title="${userEmail}">${userEmail}</span>
                    </div>
                </div>
                <div class="dropdown-divider"></div>
                <nav class="dropdown-nav">
                    <a href="#" class="dropdown-link" id="dropdown-orders-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                        <span>My Orders</span>
                    </a>
                    <a href="${settingsUrl}" class="dropdown-link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        <span>Account Settings</span>
                    </a>
                </nav>
                <div class="dropdown-divider"></div>
                <button type="button" class="dropdown-logout-action" id="dropdown-logout-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    <span>Log out</span>
                </button>
            </div>
        `;

        // Setup dropdown toggle logic
        const btn = wrapper.querySelector('.user-profile-btn');
        const dropdown = wrapper.querySelector('.user-profile-dropdown');
        const ordersBtn = wrapper.querySelector('#dropdown-orders-btn');
        const logoutBtn = wrapper.querySelector('#dropdown-logout-btn');

        if (btn && dropdown) {
            btn.onclick = (e) => {
                e.stopPropagation();
                const isOpen = wrapper.classList.toggle('open');
                btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                dropdown.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            };
        }

        if (ordersBtn) {
            ordersBtn.onclick = (e) => {
                e.preventDefault();
                wrapper.classList.remove('open');
                if (btn) btn.setAttribute('aria-expanded', 'false');
                if (dropdown) dropdown.setAttribute('aria-hidden', 'true');

                if (typeof openOrdersModal === 'function') {
                    openOrdersModal();
                } else {
                    window.location.href = 'catalog.html?openOrders=true';
                }
            };
        }

        if (logoutBtn) {
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                logoutUser();
            };
        }
    });

    // Close dropdown when clicking outside
    if (!window._userProfileClickListenerAdded) {
        window._userProfileClickListenerAdded = true;
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.user-profile-menu-wrapper.open').forEach(wrapper => {
                if (!wrapper.contains(e.target)) {
                    wrapper.classList.remove('open');
                    const btn = wrapper.querySelector('.user-profile-btn');
                    const dd = wrapper.querySelector('.user-profile-dropdown');
                    if (btn) btn.setAttribute('aria-expanded', 'false');
                    if (dd) dd.setAttribute('aria-hidden', 'true');
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.user-profile-menu-wrapper.open').forEach(wrapper => {
                    wrapper.classList.remove('open');
                    const btn = wrapper.querySelector('.user-profile-btn');
                    const dd = wrapper.querySelector('.user-profile-dropdown');
                    if (btn) btn.setAttribute('aria-expanded', 'false');
                    if (dd) dd.setAttribute('aria-hidden', 'true');
                });
            }
        });
    }

    // Handle drawer/panel links
    const panelLinks = document.querySelectorAll('.panel-item[href="login.html"], .panel-item[onclick*="logoutUser"]');
    panelLinks.forEach(link => {
        if (token) {
            link.textContent = 'Log out';
            link.href = '#';
            link.onclick = (e) => {
                e.preventDefault();
                logoutUser();
            };
        } else {
            link.textContent = 'Log in';
            link.href = loginUrl;
            link.onclick = null;
        }
    });
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
    const token = getAuthToken();
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
    const token = getAuthToken(); // Saved during login

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
    const token = getAuthToken();

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
    const token = getAuthToken();
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
    const token = getAuthToken();
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
    const token = getAuthToken();
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
    const token = getAuthToken();
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
    const token = getAuthToken();
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
    const token = getAuthToken();
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
    const token = getAuthToken();
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
    setAuthSession({
        token: token,
        role: getUserRole(),
        id: getUserId(),
        email: getUserEmail(),
        upi_id: upiId,
        upi_qr_url: data.upi_qr_url || getUpiQrUrl()
    });
    return data;
}
