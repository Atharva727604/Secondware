// ==========================================
// CART MANAGEMENT SYSTEM
// ==========================================

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

    // Check if product already exists in cart
    const existingItemIndex = cart.findIndex(item => item.id === product.id);

    if (existingItemIndex > -1) {
        // Update quantity if already in cart
        cart[existingItemIndex].quantity += quantity;
    } else {
        // Add new item to cart
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
    cart = cart.filter(item => item.id !== productId);
    saveCart(cart);
}

// Update item quantity
function updateCartQuantity(productId, newQuantity) {
    const cart = getCart();
    const item = cart.find(item => item.id === productId);

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

// ==========================================
// CART UI MANAGEMENT
// ==========================================

// Update cart badge count
function updateCartBadge() {
    const badge = document.getElementById('cart-count');
    if (badge) {
        const count = getCartItemCount();
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
        <div class="cart-item" data-product-id="${item.id}">
            <div class="cart-item-image">
                ${item.image ? `<img src="${item.image}" alt="${escapeHTML(item.name)}" onerror="this.src='https://placehold.co/100x100?text=Error'">` : '📦'}
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${escapeHTML(item.name)}</div>
                <div class="cart-item-price">₹${item.price.toLocaleString()}</div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">−</button>
                    <span class="qty-display">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
                </div>
            </div>
            <button class="remove-btn" onclick="removeFromCart(${item.id})" aria-label="Remove">🗑️</button>
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
    // Create notification element
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

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
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
    // Initialize cart UI
    updateCartUI();

    // Cart toggle button
    const cartToggle = document.getElementById('cart-toggle');
    if (cartToggle) {
        cartToggle.addEventListener('click', openCartPanel);
    }

    // Cart close button
    const cartClose = document.getElementById('cart-close');
    if (cartClose) {
        cartClose.addEventListener('click', closeCartPanel);
    }

    // Cart overlay click
    const cartOverlay = document.getElementById('cart-overlay');
    if (cartOverlay) {
        cartOverlay.addEventListener('click', closeCartPanel);
    }

    // Close cart with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCartPanel();
        }
    });

    // Proceed to pay button
    const proceedButton = document.getElementById('proceed-to-pay');
    if (proceedButton) {
        proceedButton.addEventListener('click', () => {
            const cart = getCart();
            if (cart.length === 0) {
                alert('Your cart is empty!');
                return;
            }

            // Close cart panel and open checkout modal
            closeCartPanel();
            openCheckoutModal('cart');
        });
    }
});
