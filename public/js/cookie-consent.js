/**
 * Cookie Consent Logic for SecondWare
 */

(function () {
    const COOKIE_CONSENT_KEY = 'secondware_cookie_consent';

    function initCookieConsent() {
        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);

        // If consent is already given (either accepted or rejected), don't show the banner
        if (consent !== null) {
            return;
        }

        // Create the banner element
        const banner = document.createElement('div');
        banner.className = 'cookie-banner';
        banner.id = 'cookie-consent-banner';
        banner.innerHTML = `
            <div class="cookie-content">
                <p>We use cookies to enhance your experience, analyze site traffic, and serve better ads. By clicking "Accept", you agree to our use of cookies.</p>
            </div>
            <div class="cookie-actions">
                <button class="btn-cookie reject" id="cookie-reject">Reject</button>
                <button class="btn-cookie accept" id="cookie-accept">Accept</button>
            </div>
        `;

        document.body.appendChild(banner);

        // Transition in
        setTimeout(() => {
            banner.classList.add('active');
        }, 500);

        // Handle Accept
        document.getElementById('cookie-accept').addEventListener('click', () => {
            setConsent('accepted');
        });

        // Handle Reject
        document.getElementById('cookie-reject').addEventListener('click', () => {
            setConsent('rejected');
        });

        function setConsent(status) {
            localStorage.setItem(COOKIE_CONSENT_KEY, status);
            banner.classList.remove('active');

            // Remove from DOM after transition
            setTimeout(() => {
                banner.remove();
            }, 400);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCookieConsent);
    } else {
        initCookieConsent();
    }
})();
