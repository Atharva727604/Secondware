// ==========================================
// PRODUCT CATALOG MANAGEMENT
// ==========================================

let allProducts = [];
let currentProduct = null;
let checkoutMode = null; // 'cart' or 'buynow'

// Product helpers
function getProductStars(rating) {
    return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
}

// Fetch and display products
async function loadProducts() {
    const loadingState = document.getElementById('loading-state');
    const productGrid = document.getElementById('product-grid');
    const emptyState = document.getElementById('empty-state');

    try {
        // Show loading
        if (loadingState) loadingState.style.display = 'block';
        if (productGrid) productGrid.style.display = 'none';
        if (emptyState) emptyState.setAttribute('hidden', '');

        // Protocol check: API calls won't work on file://
        if (window.location.protocol === 'file:') {
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) {
                emptyState.removeAttribute('hidden');
                emptyState.innerHTML = `
                    <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 8px; color: #856404; margin-bottom: 20px;">
                        <strong>⚠️ Local Development Required</strong>
                        <p>The product catalog cannot load when the file is opened directly (file:// protocol).</p>
                        <p style="margin-top:10px;">To fix this, please run <code>npm run dev</code> in your project terminal and open the provided localhost link.</p>
                    </div>
                `;
            }
            return;
        }

        // Fetch products from API
        const products = await fetchAllProducts();

        if (!Array.isArray(products)) {
            console.error('Products API returned error:', products);
            throw new Error(products.error || 'Failed to load product data. Check server logs.');
        }

        allProducts = products;

        // Hide loading
        if (loadingState) loadingState.style.display = 'none';

        if (products.length === 0) {
            // Show empty state
            if (emptyState) emptyState.removeAttribute('hidden');
        } else {
            // Display products
            if (productGrid) {
                productGrid.style.display = 'grid';
                renderProducts(products);
            }
        }
    } catch (error) {
        console.error('Error loading products:', error);
        if (loadingState) loadingState.style.display = 'none';
        if (emptyState) {
            emptyState.removeAttribute('hidden');
            emptyState.innerHTML = `<p>Error loading products. Please try again later.</p><p style="font-size:12px;color:#999;">${error.message}</p>`;
        }
    }
}

// Render products in grid
function renderProducts(products) {
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) return;

    productGrid.innerHTML = products.map(product => {
        const rating = product.rating || 4.5;
        const stars = getProductStars(rating);

        const isOutOfStock = (product.stock_quantity || 0) <= 0;

        return `
            <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-product-id="${product.id}">
                <div class="product-id-badge">ID: ${product.id}</div>
                <div class="product-image" onclick="openProductModal(${product.id})">
                    ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}" style="${isOutOfStock ? 'filter: grayscale(1); opacity: 0.7;' : ''}">` : ''}
                    ${isOutOfStock ? '<div class="out-of-stock-badge" style="position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; z-index: 10;">OUT OF STOCK</div>' : ''}
                </div>
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-rating">
                        ${stars}
                        <span class="rating-value">${rating}</span>
                    </div>
                    <div class="product-price">₹${Number(product.price).toLocaleString()}</div>
                    <div class="product-actions">
                        <button class="btn-secondary" onclick="handleAddToCart(${product.id}); event.stopPropagation();" ${isOutOfStock ? 'disabled style="background: #eee; color: #999; border-color: #ddd; cursor: not-allowed;"' : ''}>
                            Add to Cart
                        </button>
                        <button class="btn-primary" onclick="handleBuyNow(${product.id}); event.stopPropagation();" ${isOutOfStock ? 'disabled style="background: #ccc; border-color: #ccc; cursor: not-allowed;"' : ''}>
                            Buy Now
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// PRODUCT MODAL
// ==========================================

function openProductModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    currentProduct = product;

    const modal = document.getElementById('product-modal');
    const modalImage = document.getElementById('modal-product-image');
    const modalName = document.getElementById('modal-product-name');
    const modalRating = document.getElementById('modal-product-rating');
    const modalPrice = document.getElementById('modal-product-price');
    const modalDescription = document.getElementById('modal-product-description');

    if (modal) {
        const rating = product.rating || 4.5;
        const stars = getProductStars(rating);

        const isOutOfStock = (product.stock_quantity || 0) <= 0;

        if (modalImage) {
            modalImage.src = product.image_url || '';
            modalImage.style.display = product.image_url ? 'block' : 'none';
            modalImage.alt = product.name;
            modalImage.style.filter = isOutOfStock ? 'grayscale(1)' : 'none';
        }
        if (modalName) modalName.textContent = product.name;
        if (modalRating) modalRating.innerHTML = `${stars} <span class="rating-value">${rating}</span>`;
        if (modalPrice) modalPrice.textContent = `₹${Number(product.price).toLocaleString()}`;
        if (modalDescription) {
            modalDescription.innerHTML = `
                ${isOutOfStock ? '<div style="color: #dc3545; font-weight: 600; margin-bottom: 15px;">⚠️ Currently Out of Stock</div>' : ''}
                ${product.description || 'No description available.'}
            `;
        }

        // Disable modal buttons
        const modalCartBtn = document.getElementById('modal-add-to-cart');
        const modalBuyBtn = document.getElementById('modal-buy-now');
        if (modalCartBtn) {
            modalCartBtn.disabled = isOutOfStock;
            modalCartBtn.style.opacity = isOutOfStock ? '0.5' : '1';
            modalCartBtn.style.cursor = isOutOfStock ? 'not-allowed' : 'pointer';
        }
        if (modalBuyBtn) {
            modalBuyBtn.disabled = isOutOfStock;
            modalBuyBtn.style.opacity = isOutOfStock ? '0.5' : '1';
            modalBuyBtn.style.cursor = isOutOfStock ? 'not-allowed' : 'pointer';
        }

        modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.setAttribute('hidden', '');
        document.body.style.overflow = '';
        // Don't clear currentProduct here - it's needed for buynow checkout
        // currentProduct = null;
    }
}

// ==========================================
// CHECKOUT MODAL
// ==========================================

function openCheckoutModal(mode) {
    checkoutMode = mode;
    const modal = document.getElementById('checkout-modal');
    if (modal) {
        // Pre-calculate subtotal
        let subtotal = 0;
        if (mode === 'buynow' && currentProduct) {
            subtotal = currentProduct.price;
        } else {
            const cart = getCart();
            subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }

        document.getElementById('summary-subtotal').textContent = `₹${subtotal.toLocaleString()}`;
        document.getElementById('fee-summary').style.display = 'block';
        updateCatalogFee();

        modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function updateCatalogFee() {
    const state = document.getElementById('customer-state').value;
    let items = [];
    let subtotal = 0;

    if (checkoutMode === 'buynow' && currentProduct) {
        items = [currentProduct];
        subtotal = currentProduct.price;
    } else {
        items = getCart();
        subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    const fee = calculateDeliveryFee(state, items);

    document.getElementById('summary-fee').textContent = `₹${fee.toLocaleString()}`;
    document.getElementById('summary-total').textContent = `₹${(subtotal + fee).toLocaleString()}`;
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) {
        modal.setAttribute('hidden', '');
        document.body.style.overflow = '';
        checkoutMode = null;
    }
}

// ==========================================
// PRODUCT ACTIONS
// ==========================================

function handleAddToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
        addToCart(product, 1);
    }
}

function handleBuyNow(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
        currentProduct = product;
        openCheckoutModal('buynow');
    }
}

// ==========================================
// PAYMENT PROCESSING
// ==========================================

async function processPayment(customerName, customerEmail, customerPhone, customerAddress, state, deliveryFee) {
    try {
        const token = sessionStorage.getItem('auth_token');

        // Check if user is logged in
        if (!token) {
            const shouldLogin = confirm('You need to be logged in to make a purchase. Would you like to login now?');
            if (shouldLogin) {
                // Store cart and redirect to login
                window.location.href = '/login.html';
            }
            return;
        }

        let items;

        if (checkoutMode === 'buynow' && currentProduct) {
            // Single product purchase
            items = [{
                product_id: currentProduct.id,
                quantity: 1,
                price: currentProduct.price
            }];
        } else {
            // Cart purchase
            const cart = getCart();
            items = cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                price: item.price
            }));
        }

        if (items.length === 0) {
            alert('No items to purchase!');
            return;
        }

        // Create order and get payment session
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: items,
                delivery_fee: deliveryFee,
                customer_details: {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    address: `${customerAddress}, ${state}`
                }
            })
        });

        const result = await response.json();

        if (response.ok && result.payment_session_id) {
            // Initialize Cashfree checkout
            // Cashfree is initialized in api.js globally if loaded
            const cashfree = typeof Cashfree !== 'undefined' ? Cashfree({ mode: "production" }) : null;

            if (!cashfree) {
                alert("Payment gateway SDK not loaded. Please try refreshing the page.");
                return;
            }

            let checkoutOptions = {
                paymentSessionId: result.payment_session_id,
                redirectTarget: "_self"
            };

            // Clear cart if it was a cart purchase
            if (checkoutMode === 'cart') {
                clearCart();
            }

            // Open Cashfree payment page
            cashfree.checkout(checkoutOptions);
        } else {
            alert('Payment initialization failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed. Please try again.');
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Load products on page load
    loadProducts();

    // Setup checkout form field validation
    const customerNameInput = document.getElementById('customer-name');
    const customerPhoneInput = document.getElementById('customer-phone');
    const customerAddressInput = document.getElementById('customer-address');

    if (customerNameInput) {
        customerNameInput.addEventListener('blur', () => {
            const value = customerNameInput.value.trim();
            if (value) {
                const isValid = isValidName(value);
                showValidationFeedback(customerNameInput, isValid, isValid ? '' : 'Invalid name format');
            }
        });
    }

    if (customerPhoneInput) {
        customerPhoneInput.addEventListener('blur', () => {
            const value = customerPhoneInput.value.trim();
            if (value) {
                const isValid = isValidPhone(value);
                showValidationFeedback(customerPhoneInput, isValid, isValid ? '' : 'Invalid phone number');
            }
        });
    }

    if (customerAddressInput) {
        customerAddressInput.addEventListener('blur', () => {
            const value = customerAddressInput.value.trim();
            if (value) {
                const isValid = isValidAddress(value);
                showValidationFeedback(customerAddressInput, isValid, isValid ? '' : 'Address too short');
            }
        });
    }

    // Product modal close button
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeProductModal);
    }

    // Product modal overlay
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeProductModal);
    }

    // Modal add to cart button
    const modalAddToCart = document.getElementById('modal-add-to-cart');
    if (modalAddToCart) {
        modalAddToCart.addEventListener('click', () => {
            if (currentProduct) {
                addToCart(currentProduct, 1);
                closeProductModal();
            }
        });
    }

    // Modal buy now button
    const modalBuyNow = document.getElementById('modal-buy-now');
    if (modalBuyNow) {
        modalBuyNow.addEventListener('click', () => {
            // Store the product before closing modal
            const productToCheckout = currentProduct;
            closeProductModal();
            // Restore currentProduct before opening checkout
            currentProduct = productToCheckout;
            openCheckoutModal('buynow');
        });
    }

    // Checkout modal close button
    const checkoutClose = document.getElementById('checkout-close');
    if (checkoutClose) {
        checkoutClose.addEventListener('click', closeCheckoutModal);
    }

    // Checkout modal overlay
    const checkoutOverlay = document.getElementById('checkout-overlay');
    if (checkoutOverlay) {
        checkoutOverlay.addEventListener('click', closeCheckoutModal);
    }

    const stateSelect = document.getElementById('customer-state');
    if (stateSelect) {
        stateSelect.addEventListener('change', updateCatalogFee);
    }

    // Checkout form submission
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('customer-name').value.trim();
            const email = sessionStorage.getItem('user_email');
            const phone = document.getElementById('customer-phone').value.trim();
            const address = document.getElementById('customer-address').value.trim();
            const termsAccepted = document.getElementById('terms-consent').checked;

            // Validate all fields
            if (!termsAccepted) {
                alert('You must accept the Terms and Conditions to proceed.');
                return;
            }

            if (!isValidName(name)) {
                alert('Please enter a valid name (2-50 characters, letters and spaces only).');
                showValidationFeedback(document.getElementById('customer-name'), false, 'Invalid name');
                return;
            }

            if (!isValidPhone(phone)) {
                alert('Please enter a valid 10-digit phone number.');
                showValidationFeedback(document.getElementById('customer-phone'), false, 'Invalid phone number');
                return;
            }

            if (!isValidAddress(address)) {
                alert('Please enter a valid address (minimum 5 characters).');
                showValidationFeedback(document.getElementById('customer-address'), false, 'Invalid address');
                return;
            }

            if (!email) {
                alert('Error: Email not found. Please login again.');
                return;
            }

            // Save checkout mode before closing modal
            const mode = checkoutMode;
            const product = currentProduct;
            const deliveryFee = calculateDeliveryFee(termsAccepted ? document.getElementById('customer-state').value : '', mode === 'buynow' ? [product] : getCart());

            closeCheckoutModal();

            // Show processing message
            const processingMsg = document.createElement('div');
            processingMsg.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 30px 50px;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                z-index: 5000;
                text-align: center;
            `;
            processingMsg.innerHTML = `
                <div class="spinner" style="margin: 0 auto 20px;"></div>
                <p style="font-size: 18px; color: #004a7c;">Processing payment...</p>
            `;
            document.body.appendChild(processingMsg);

            // Restore mode and product for payment processing
            checkoutMode = mode;
            currentProduct = product;

            // Update processPayment call to include deliveryFee
            await processPayment(name, email, phone, address, document.getElementById('customer-state').value, deliveryFee);

            processingMsg.remove();
        });
    }

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductModal();
            closeCheckoutModal();
        }
    });

    // ==========================================
    // SEARCH FUNCTIONALITY
    // ==========================================
    const productSearch = document.getElementById('product-search');
    const searchBtn = document.getElementById('search-btn');

    // Unified Filter Logic
    function applyAllFilters() {
        const activeCategories = Array.from(document.querySelectorAll('.category-card.active'))
            .map(card => card.getAttribute('data-category').toLowerCase());

        const searchTerm = (document.getElementById('product-search')?.value || '').toLowerCase().trim();

        let filtered = allProducts;

        // 1. Filter by categories (AND logic)
        if (activeCategories.length > 0) {
            filtered = filtered.filter(product => {
                // Ensure category is an array and filter out any nulls
                const rawCategory = Array.isArray(product.category) ? product.category : [product.category];
                const prodCategories = rawCategory
                    .filter(c => c !== null && c !== undefined)
                    .map(c => String(c).toLowerCase());

                const prodName = String(product.name || '').toLowerCase();

                // Product must match ALL selected categories
                return activeCategories.every(searchCat =>
                    prodCategories.includes(searchCat) || prodName.includes(searchCat)
                );
            });
        }

        // 2. Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(product =>
                String(product.name || '').toLowerCase().includes(searchTerm) ||
                String(product.description || '').toLowerCase().includes(searchTerm)
            );
        }

        renderProducts(filtered);
    }

    if (productSearch) {
        productSearch.addEventListener('input', applyAllFilters);
        productSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyAllFilters();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', applyAllFilters);
    }

    // ==========================================
    // CATEGORY SCROLL & FILTERING
    // ==========================================
    const categoryScroll = document.getElementById('category-scroll');
    const scrollLeft = document.getElementById('scroll-left');
    const scrollRight = document.getElementById('scroll-right');
    const categoryCards = document.querySelectorAll('.category-card');

    if (categoryScroll && scrollLeft && scrollRight) {
        scrollLeft.addEventListener('click', () => {
            categoryScroll.scrollBy({ left: -300, behavior: 'smooth' });
        });

        scrollRight.addEventListener('click', () => {
            categoryScroll.scrollBy({ left: 300, behavior: 'smooth' });
        });
    }

    // Category Scroll and Multi-Select removed redundancy
    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('active');
            applyAllFilters();
        });
    });
});