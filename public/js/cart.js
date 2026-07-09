// ==========================================
// CART MANAGEMENT SYSTEM
// ==========================================

// Small local escape helper to ensure safe HTML insertion
function escapeHTML(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}

// Get cart from localStorage
function getCart() {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : [];
}

// Save cart to localStorage
function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

// Add item to cart
function addToCart(product, quantity = 1) {
    const cart = getCart();

    const existingItemIndex = cart.findIndex(item => item.id == product.id);

    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity += quantity;
    } else {
        const imageUrl = product.image_url || (product.image_urls && product.image_urls[0]) || product.image;
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity,
            image: imageUrl || null
        });
    }

    saveCart(cart);
    showCartNotification(`${product.name} added to cart!`);
}

// Remove item from cart
function removeFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => item.id != productId);
    saveCart(cart);
}

// Update item quantity
function updateCartQuantity(productId, newQuantity) {
    const cart = getCart();
    const item = cart.find(item => item.id == productId);

    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = newQuantity;
            saveCart(cart);
        }
    }
}

// Calculate cart total
function getCartTotal() {
    const cart = getCart();
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Get cart item count
function getCartItemCount() {
    const cart = getCart();
    return cart.reduce((count, item) => count + item.quantity, 0);
}

// Clear cart
function clearCart() {
    localStorage.removeItem('cart');
    updateCartUI();
}

// Update cart badge count
function updateCartBadge() {
    const count = getCartItemCount();

    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Render cart items in sidebar
function renderCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) return;

    const cart = getCart();

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="cart-empty">
                <p>Your cart is empty</p>
                <p>Add some products to get started!</p>
            </div>
        `;
        return;
    }

    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item" data-product-id="${escapeHTML(String(item.id))}">
            <div class="cart-item-image">
                ${item.image ? `<img src="${encodeURI(item.image)}" alt="${escapeHTML(item.name)}" onerror="this.onerror=null; this.src='https://placehold.co/100x100?text=Error'">` : '📦'}
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${escapeHTML(item.name)}</div>
                <div class="cart-item-price">₹${escapeHTML(Number(item.price).toLocaleString())}</div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="updateCartQuantity('${escapeHTML(String(item.id))}', ${parseInt(item.quantity) - 1})">−</button>
                    <span class="qty-display">${escapeHTML(String(item.quantity))}</span>
                    <button class="qty-btn" onclick="updateCartQuantity('${escapeHTML(String(item.id))}', ${parseInt(item.quantity) + 1})">+</button>
                </div>
            </div>
            <button class="remove-btn" onclick="removeFromCart('${escapeHTML(String(item.id))}')" aria-label="Remove">🗑️</button>
        </div>
    `).join('');
}

// Update cart total display
function updateCartTotal() {
    const totalElement = document.getElementById('cart-total-amount');
    if (totalElement) {
        const total = getCartTotal();
        totalElement.textContent = `₹${total.toLocaleString()}`;
    }
}

// Update entire cart UI
function updateCartUI() {
    updateCartBadge();
    renderCartItems();
    updateCartTotal();
}

// Show cart notification
function showCartNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #008b94 0%, #004a7c 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 4000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==========================================
// CART PANEL TOGGLE
// ==========================================

function openCartPanel() {
    const panel = document.getElementById('cart-panel');
    const overlay = document.getElementById('cart-overlay');

    if (panel && overlay) {
        panel.classList.add('active');
        overlay.classList.add('active');
        overlay.removeAttribute('hidden');
        panel.setAttribute('aria-hidden', 'false');
        updateCartUI();
    }
}

function closeCartPanel() {
    const panel = document.getElementById('cart-panel');
    const overlay = document.getElementById('cart-overlay');

    if (panel && overlay) {
        panel.classList.remove('active');
        overlay.classList.remove('active');
        overlay.setAttribute('hidden', '');
        panel.setAttribute('aria-hidden', 'true');
    }
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Inject Cart and Wishlist sidebars if not present
    if (!document.getElementById('cart-panel')) {
        const cartOverlay = document.createElement('div');
        cartOverlay.id = 'cart-overlay';
        cartOverlay.className = 'cart-overlay';
        cartOverlay.setAttribute('hidden', '');
        document.body.appendChild(cartOverlay);

        const cartPanel = document.createElement('aside');
        cartPanel.id = 'cart-panel';
        cartPanel.className = 'cart-panel';
        cartPanel.setAttribute('aria-hidden', 'true');
        cartPanel.innerHTML = `
            <button class="close-btn" id="cart-close" aria-label="Close">✕</button>
            <div class="cart-content">
                <h3>Shopping Cart</h3>
                <div id="cart-items" class="cart-items-list">
                    <!-- Cart items will be dynamically inserted here -->
                </div>
                <div class="cart-footer">
                    <div class="cart-total">
                        <span>Total:</span>
                        <span id="cart-total-amount">₹0</span>
                    </div>
                    <button id="proceed-to-pay" class="btn-primary btn-block">Proceed to Pay</button>
                </div>
            </div>
        `;
        document.body.appendChild(cartPanel);
    }

    if (!document.getElementById('wishlist-panel')) {
        const wishlistOverlay = document.createElement('div');
        wishlistOverlay.id = 'wishlist-overlay';
        wishlistOverlay.className = 'cart-overlay';
        wishlistOverlay.setAttribute('hidden', '');
        document.body.appendChild(wishlistOverlay);

        const wishlistPanel = document.createElement('aside');
        wishlistPanel.id = 'wishlist-panel';
        wishlistPanel.className = 'cart-panel wishlist-panel';
        wishlistPanel.setAttribute('aria-hidden', 'true');
        wishlistPanel.innerHTML = `
            <button class="close-btn" id="wishlist-close" aria-label="Close">✕</button>
            <div class="cart-content">
                <h3>❤️ My Wishlist</h3>
                <div id="wishlist-items" class="cart-items-list">
                    <!-- Wishlist items will be dynamically inserted here -->
                </div>
            </div>
        `;
        document.body.appendChild(wishlistPanel);
    }

    updateCartUI();

    const cartToggle = document.getElementById('cart-toggle');
    if (cartToggle) cartToggle.addEventListener('click', openCartPanel);

    const cartClose = document.getElementById('cart-close');
    if (cartClose) cartClose.addEventListener('click', closeCartPanel);

    const cartOverlay = document.getElementById('cart-overlay');
    if (cartOverlay) cartOverlay.addEventListener('click', closeCartPanel);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeCartPanel();
    });

    const proceedButton = document.getElementById('proceed-to-pay');
    if (proceedButton) {
        proceedButton.addEventListener('click', () => {
            const cart = getCart();
            if (cart.length === 0) {
                alert('Your cart is empty!');
                return;
            }
            closeCartPanel();
            if (typeof openCheckoutModal === 'function') {
                openCheckoutModal('cart');
            } else {
                // Redirect to catalog page with checkout parameter
                window.location.href = 'catalog.html?checkout=true';
            }
        });
    }

    // Wishlist panel listeners
    const wishlistToggle = document.getElementById('wishlist-toggle');
    if (wishlistToggle) wishlistToggle.addEventListener('click', openWishlistPanel);

    const wishlistClose = document.getElementById('wishlist-close');
    if (wishlistClose) wishlistClose.addEventListener('click', closeWishlistPanel);

    const wishlistOverlay = document.getElementById('wishlist-overlay');
    if (wishlistOverlay) wishlistOverlay.addEventListener('click', closeWishlistPanel);

    updateWishlistUI();
});

// ==========================================
// WISHLIST MANAGEMENT SYSTEM
// ==========================================

// Get wishlist from localStorage
function getWishlist() {
    const wishlist = localStorage.getItem('wishlist');
    return wishlist ? JSON.parse(wishlist) : [];
}

// Save wishlist to localStorage
function saveWishlist(wishlist) {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistUI();
}

// Check if a product is in the wishlist
function isInWishlist(productId) {
    const wishlist = getWishlist();
    return wishlist.some(item => item.id == productId);
}

// Toggle wishlist (add/remove)
function toggleWishlist(product) {
    const wishlist = getWishlist();
    const existingIndex = wishlist.findIndex(item => item.id == product.id);

    if (existingIndex > -1) {
        wishlist.splice(existingIndex, 1);
        saveWishlist(wishlist);
        showCartNotification(`${product.name} removed from wishlist`);
    } else {
        const imageUrl = product.image_url || (product.image_urls && product.image_urls[0]) || product.image;
        wishlist.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: imageUrl || null
        });
        saveWishlist(wishlist);
        showCartNotification(`${product.name} added to wishlist! ❤️`);
    }
}

// Remove item from wishlist
function removeFromWishlist(productId) {
    let wishlist = getWishlist();
    wishlist = wishlist.filter(item => item.id != productId);
    saveWishlist(wishlist);
}

// Get wishlist item count
function getWishlistCount() {
    return getWishlist().length;
}

// Update wishlist badge count
function updateWishlistBadge() {
    const count = getWishlistCount();
    const badge = document.getElementById('wishlist-count');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Render wishlist items in sidebar
function renderWishlistItems() {
    const container = document.getElementById('wishlist-items');
    if (!container) return;

    const wishlist = getWishlist();

    if (wishlist.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <p style="font-size: 2rem; margin-bottom: 10px;">💝</p>
                <p>Your wishlist is empty</p>
                <p>Tap the ♡ on products you love!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = wishlist.map(item => `
        <div class="cart-item" data-product-id="${escapeHTML(String(item.id))}">
            <div class="cart-item-image">
                ${item.image ? `<img src="${encodeURI(item.image)}" alt="${escapeHTML(item.name)}" onerror="this.onerror=null; this.src='https://placehold.co/100x100?text=Error'">` : '💝'}
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${escapeHTML(item.name)}</div>
                <div class="cart-item-price">₹${escapeHTML(Number(item.price).toLocaleString())}</div>
                <button class="wishlist-to-cart-btn" onclick="moveWishlistToCart('${escapeHTML(String(item.id))}')">🛒 Add to Cart</button>
            </div>
            <button class="remove-btn" onclick="removeFromWishlist('${escapeHTML(String(item.id))}')" aria-label="Remove">🗑️</button>
        </div>
    `).join('');
}

// Move item from wishlist to cart
function moveWishlistToCart(productId) {
    const wishlist = getWishlist();
    const item = wishlist.find(i => i.id == productId);
    if (item) {
        addToCart({
            id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image
        }, 1);
        removeFromWishlist(productId);
        showCartNotification(`${item.name} moved to cart! 🛒`);
    }
}

// Update entire wishlist UI
function updateWishlistUI() {
    updateWishlistBadge();
    renderWishlistItems();
}

// ==========================================
// WISHLIST PANEL TOGGLE
// ==========================================

function openWishlistPanel() {
    const token = sessionStorage.getItem('auth_token');
    if (!token) {
        const goLogin = confirm('You need to be logged in to view your wishlist. Login now?');
        if (goLogin) {
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            sessionStorage.setItem('login_referrer', currentPage);
            window.location.href = 'login.html';
        }
        return;
    }

    const panel = document.getElementById('wishlist-panel');
    const overlay = document.getElementById('wishlist-overlay');

    if (panel && overlay) {
        panel.classList.add('active');
        overlay.classList.add('active');
        overlay.removeAttribute('hidden');
        panel.setAttribute('aria-hidden', 'false');
        updateWishlistUI();
    }
}

function closeWishlistPanel() {
    const panel = document.getElementById('wishlist-panel');
    const overlay = document.getElementById('wishlist-overlay');

    if (panel && overlay) {
        panel.classList.remove('active');
        overlay.classList.remove('active');
        overlay.setAttribute('hidden', '');
        panel.setAttribute('aria-hidden', 'true');
    }
}
