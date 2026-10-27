/**
 * Netlify-style Cookie Consent Popup & Preferences Manager for SecondWare
 */

(function () {
    const COOKIE_CONSENT_KEY = 'secondware_cookie_consent';
    const COOKIE_PREFS_KEY = 'secondware_cookie_preferences';

    // Inject styles dynamically so the popup looks identical on every page
    function injectStyles() {
        if (document.getElementById('cookie-popup-styles')) return;

        const style = document.createElement('style');
        style.id = 'cookie-popup-styles';
        style.textContent = `
            /* ── NETLIFY COOKIE BANNER POPUP ── */
            #cookie-consent-banner.netlify-cookie-popup {
                position: fixed;
                bottom: 24px;
                left: 24px;
                width: 360px;
                max-width: calc(100vw - 32px);
                background: #0b171c;
                background: linear-gradient(165deg, #0d1e24 0%, #071216 100%);
                border: 1px solid rgba(45, 212, 191, 0.22);
                border-radius: 14px;
                box-shadow: 0 20px 45px -8px rgba(0, 0, 0, 0.8),
                            0 0 0 1px rgba(255, 255, 255, 0.05),
                            0 0 32px -4px rgba(45, 212, 191, 0.08);
                padding: 18px 20px 16px 20px;
                z-index: 99999;
                color: #e2e8f0;
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                box-sizing: border-box;
                opacity: 0;
                transform: translateY(20px) scale(0.97);
                transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
                            transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: none;
            }

            #cookie-consent-banner.netlify-cookie-popup.active {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
            }

            .cookie-popup-body {
                display: flex;
                align-items: flex-start;
                gap: 13px;
                margin-bottom: 16px;
            }

            .cookie-popup-icon-wrap {
                flex-shrink: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-top: 2px;
            }

            .cookie-popup-icon-wrap svg {
                width: 30px;
                height: 30px;
                display: block;
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
            }

            .cookie-popup-text {
                font-size: 13px;
                line-height: 1.48;
                color: #cad5da;
                margin: 0;
                letter-spacing: -0.01em;
            }

            .cookie-popup-text a.cookie-policy-link {
                color: #ffffff;
                text-decoration: underline;
                text-underline-offset: 3px;
                font-weight: 600;
                transition: color 0.15s ease;
                cursor: pointer;
            }

            .cookie-popup-text a.cookie-policy-link:hover {
                color: #2dd4bf;
            }

            .cookie-popup-actions {
                display: flex;
                gap: 10px;
                margin-bottom: 12px;
            }

            .cookie-popup-btn {
                flex: 1;
                height: 38px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
                font-family: inherit;
                outline: none;
            }

            .cookie-popup-btn.btn-reject {
                background: transparent;
                border: 1.5px solid #24b89d;
                color: #ffffff;
            }

            .cookie-popup-btn.btn-reject:hover {
                background: rgba(36, 184, 157, 0.14);
                border-color: #5eead4;
                color: #5eead4;
                transform: translateY(-1px);
            }

            .cookie-popup-btn.btn-accept {
                background: #24b89d;
                border: 1.5px solid #24b89d;
                color: #06191f;
            }

            .cookie-popup-btn.btn-accept:hover {
                background: #2dd4bf;
                border-color: #2dd4bf;
                box-shadow: 0 4px 14px rgba(36, 184, 157, 0.45);
                transform: translateY(-1px);
            }

            .cookie-popup-footer {
                text-align: center;
            }

            .cookie-settings-btn {
                background: none;
                border: none;
                color: #94a3b8;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                padding: 4px 8px;
                transition: color 0.15s ease;
                font-family: inherit;
                outline: none;
            }

            .cookie-settings-btn:hover {
                color: #ffffff;
                text-decoration: underline;
                text-underline-offset: 2px;
            }

            /* ── PREFERENCES & PRIVACY MODAL BACKDROP ── */
            .cookie-modal-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(4, 10, 14, 0.78);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.25s ease, visibility 0.25s ease;
            }

            .cookie-modal-backdrop.open {
                opacity: 1;
                visibility: visible;
            }

            .cookie-modal-card {
                background: #0d1e24;
                border: 1px solid rgba(45, 212, 191, 0.25);
                border-radius: 16px;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85);
                max-width: 520px;
                width: 100%;
                color: #f1f5f9;
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                overflow: hidden;
                transform: scale(0.96) translateY(8px);
                transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .cookie-modal-backdrop.open .cookie-modal-card {
                transform: scale(1) translateY(0);
            }

            .cookie-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }

            .cookie-modal-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 700;
                color: #ffffff;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .cookie-modal-close {
                background: transparent;
                border: none;
                color: #94a3b8;
                font-size: 22px;
                cursor: pointer;
                width: 32px;
                height: 32px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s, color 0.15s;
            }

            .cookie-modal-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }

            .cookie-modal-body {
                padding: 20px 24px;
                max-height: 60vh;
                overflow-y: auto;
                font-size: 13.5px;
                line-height: 1.55;
                color: #b6c5cb;
            }

            .cookie-modal-body p {
                margin-top: 0;
                margin-bottom: 16px;
            }

            .cookie-pref-group {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 14px 16px;
                margin-bottom: 12px;
            }

            .cookie-pref-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 6px;
            }

            .cookie-pref-title {
                font-size: 14px;
                font-weight: 700;
                color: #ffffff;
            }

            .cookie-pref-badge {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #24b89d;
                background: rgba(36, 184, 157, 0.12);
                border: 1px solid rgba(36, 184, 157, 0.25);
                padding: 2px 8px;
                border-radius: 6px;
            }

            /* Custom switch toggle */
            .cookie-switch {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
            }

            .cookie-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .cookie-slider {
                position: absolute;
                cursor: pointer;
                inset: 0;
                background-color: #334155;
                transition: .25s;
                border-radius: 24px;
            }

            .cookie-slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .25s;
                border-radius: 50%;
            }

            .cookie-switch input:checked + .cookie-slider {
                background-color: #24b89d;
            }

            .cookie-switch input:checked + .cookie-slider:before {
                transform: translateX(20px);
            }

            .cookie-modal-footer {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 10px;
                padding: 16px 24px;
                background: rgba(0, 0, 0, 0.2);
                border-top: 1px solid rgba(255, 255, 255, 0.08);
            }

            .cookie-modal-btn {
                padding: 9px 18px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                font-family: inherit;
                transition: all 0.15s ease;
            }

            .cookie-modal-btn.secondary {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #e2e8f0;
            }

            .cookie-modal-btn.secondary:hover {
                background: rgba(255, 255, 255, 0.08);
            }

            .cookie-modal-btn.primary {
                background: #24b89d;
                border: 1px solid #24b89d;
                color: #06191f;
            }

            .cookie-modal-btn.primary:hover {
                background: #2dd4bf;
                box-shadow: 0 4px 12px rgba(36, 184, 157, 0.35);
            }

            @media (max-width: 480px) {
                #cookie-consent-banner.netlify-cookie-popup {
                    left: 12px;
                    right: 12px;
                    bottom: 12px;
                    width: auto;
                    max-width: none;
                    padding: 16px;
                }
                .cookie-modal-footer {
                    flex-direction: column-reverse;
                }
                .cookie-modal-btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function initCookieConsent() {
        injectStyles();

        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);

        // If consent is already recorded, don't show the initial popup
        if (consent !== null) {
            setupGlobalReopen();
            return;
        }

        renderBanner();
    }

    function renderBanner() {
        if (document.getElementById('cookie-consent-banner')) return;

        // Create the banner element exactly matching Netlify's bottom-left popup
        const banner = document.createElement('div');
        banner.className = 'netlify-cookie-popup';
        banner.id = 'cookie-consent-banner';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Cookie consent banner');

        banner.innerHTML = `
            <div class="cookie-popup-body">
                <div class="cookie-popup-icon-wrap" aria-hidden="true">
                    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <radialGradient id="cookieGlow" cx="30%" cy="28%" r="72%">
                                <stop offset="0%" stop-color="#FCD34D"/>
                                <stop offset="45%" stop-color="#F59E0B"/>
                                <stop offset="100%" stop-color="#D97706"/>
                            </radialGradient>
                            <filter id="cookieShadow" x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.35"/>
                            </filter>
                        </defs>
                        <!-- Cookie Body with soft bite contour -->
                        <path d="M18 2C9.163 2 2 9.163 2 18s7.163 16 16 16 16-7.163 16-16c0-1.85-.316-3.626-.897-5.275a3.5 3.5 0 0 1-4.328-4.328C27.126 5.816 22.85 2 18 2z" 
                              fill="url(#cookieGlow)" filter="url(#cookieShadow)" />
                        <!-- Chocolate Chips -->
                        <circle cx="11.5" cy="13.5" r="2.3" fill="#582405"/>
                        <circle cx="10.8" cy="13" r="0.7" fill="#873e0e"/>
                        <circle cx="20.5" cy="11.5" r="2" fill="#582405"/>
                        <circle cx="16" cy="19.5" r="2.5" fill="#582405"/>
                        <circle cx="15.2" cy="18.8" r="0.8" fill="#873e0e"/>
                        <circle cx="24.5" cy="18" r="2.1" fill="#582405"/>
                        <circle cx="12" cy="24" r="1.8" fill="#582405"/>
                        <circle cx="21" cy="25" r="2.2" fill="#582405"/>
                        <circle cx="20.3" cy="24.3" r="0.7" fill="#873e0e"/>
                        <!-- Cookie crumb accents -->
                        <circle cx="7.8" cy="19" r="0.9" fill="#92400E" opacity="0.7"/>
                        <circle cx="26.5" cy="12.5" r="1" fill="#92400E" opacity="0.7"/>
                        <circle cx="16" cy="27" r="1" fill="#92400E" opacity="0.6"/>
                    </svg>
                </div>
                <p class="cookie-popup-text">
                    We use cookies to improve your browsing experience and for marketing purposes.
                    <a href="#privacy" class="cookie-policy-link" id="cookie-read-privacy">Read our Privacy Policy</a>
                </p>
            </div>
            <div class="cookie-popup-actions">
                <button type="button" class="cookie-popup-btn btn-reject" id="cookie-reject-btn">Reject All</button>
                <button type="button" class="cookie-popup-btn btn-accept" id="cookie-accept-btn">Accept All</button>
            </div>
            <div class="cookie-popup-footer">
                <button type="button" class="cookie-settings-btn" id="cookie-settings-btn">Cookies Settings</button>
            </div>
        `;

        document.body.appendChild(banner);

        // Animate in with smooth slide-up
        requestAnimationFrame(() => {
            setTimeout(() => {
                banner.classList.add('active');
            }, 300);
        });

        // Event listeners
        document.getElementById('cookie-accept-btn').addEventListener('click', () => {
            saveConsent('accepted', { necessary: true, analytics: true, marketing: true });
        });

        document.getElementById('cookie-reject-btn').addEventListener('click', () => {
            saveConsent('rejected', { necessary: true, analytics: false, marketing: false });
        });

        document.getElementById('cookie-settings-btn').addEventListener('click', () => {
            openPreferencesModal();
        });

        document.getElementById('cookie-read-privacy').addEventListener('click', (e) => {
            e.preventDefault();
            openPrivacyPolicyModal();
        });

        setupGlobalReopen();
    }

    function saveConsent(status, prefs) {
        localStorage.setItem(COOKIE_CONSENT_KEY, status);
        localStorage.setItem(COOKIE_PREFS_KEY, JSON.stringify(prefs));

        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.classList.remove('active');
            setTimeout(() => {
                banner.remove();
            }, 350);
        }

        // Dispatch custom event for analytical/marketing tags if loaded
        try {
            window.dispatchEvent(new CustomEvent('secondware_cookie_consent', {
                detail: { status, preferences: prefs }
            }));
        } catch (_) {}
    }

    function openPreferencesModal() {
        let modalBackdrop = document.getElementById('cookie-preferences-modal');
        if (!modalBackdrop) {
            modalBackdrop = document.createElement('div');
            modalBackdrop.className = 'cookie-modal-backdrop';
            modalBackdrop.id = 'cookie-preferences-modal';
            modalBackdrop.innerHTML = `
                <div class="cookie-modal-card" role="dialog" aria-modal="true" aria-labelledby="cookie-pref-title">
                    <div class="cookie-modal-header">
                        <h3 id="cookie-pref-title">
                            <span>🍪</span> Cookie Preferences
                        </h3>
                        <button type="button" class="cookie-modal-close" id="cookie-pref-close" aria-label="Close modal">&times;</button>
                    </div>
                    <div class="cookie-modal-body">
                        <p>When you visit our website, we store cookies on your browser to collect information that may relate to you, your preferences, or your device.</p>
                        
                        <div class="cookie-pref-group">
                            <div class="cookie-pref-header">
                                <span class="cookie-pref-title">Strictly Necessary Cookies</span>
                                <span class="cookie-pref-badge">Always Active</span>
                            </div>
                            <div>Essential for site functionality, account access, and security. Cannot be disabled.</div>
                        </div>

                        <div class="cookie-pref-group">
                            <div class="cookie-pref-header">
                                <span class="cookie-pref-title">Performance &amp; Analytics Cookies</span>
                                <label class="cookie-switch">
                                    <input type="checkbox" id="pref-analytics" checked>
                                    <span class="cookie-slider"></span>
                                </label>
                            </div>
                            <div>Help us count visits and traffic sources so we can measure and improve website performance.</div>
                        </div>

                        <div class="cookie-pref-group">
                            <div class="cookie-pref-header">
                                <span class="cookie-pref-title">Marketing &amp; Targeting Cookies</span>
                                <label class="cookie-switch">
                                    <input type="checkbox" id="pref-marketing" checked>
                                    <span class="cookie-slider"></span>
                                </label>
                            </div>
                            <div>May be used by advertising partners to build a profile of your interests and show relevant ads.</div>
                        </div>
                    </div>
                    <div class="cookie-modal-footer">
                        <button type="button" class="cookie-modal-btn secondary" id="cookie-pref-reject-all">Reject All</button>
                        <button type="button" class="cookie-modal-btn primary" id="cookie-pref-save">Save Preferences</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modalBackdrop);

            // Close listeners
            modalBackdrop.addEventListener('click', (e) => {
                if (e.target === modalBackdrop) closePreferencesModal();
            });
            document.getElementById('cookie-pref-close').addEventListener('click', closePreferencesModal);

            document.getElementById('cookie-pref-reject-all').addEventListener('click', () => {
                saveConsent('rejected', { necessary: true, analytics: false, marketing: false });
                closePreferencesModal();
            });

            document.getElementById('cookie-pref-save').addEventListener('click', () => {
                const analytics = document.getElementById('pref-analytics').checked;
                const marketing = document.getElementById('pref-marketing').checked;
                saveConsent('custom', { necessary: true, analytics, marketing });
                closePreferencesModal();
            });
        }

        // Load existing preferences if available
        try {
            const saved = JSON.parse(localStorage.getItem(COOKIE_PREFS_KEY) || '{}');
            if (saved.analytics !== undefined) {
                document.getElementById('pref-analytics').checked = saved.analytics;
            }
            if (saved.marketing !== undefined) {
                document.getElementById('pref-marketing').checked = saved.marketing;
            }
        } catch (_) {}

        requestAnimationFrame(() => {
            modalBackdrop.classList.add('open');
        });
    }

    function closePreferencesModal() {
        const modalBackdrop = document.getElementById('cookie-preferences-modal');
        if (modalBackdrop) {
            modalBackdrop.classList.remove('open');
        }
    }

    function openPrivacyPolicyModal() {
        let privacyBackdrop = document.getElementById('cookie-privacy-modal');
        if (!privacyBackdrop) {
            privacyBackdrop = document.createElement('div');
            privacyBackdrop.className = 'cookie-modal-backdrop';
            privacyBackdrop.id = 'cookie-privacy-modal';
            privacyBackdrop.innerHTML = `
                <div class="cookie-modal-card" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title">
                    <div class="cookie-modal-header">
                        <h3 id="privacy-modal-title">Privacy &amp; Cookie Policy</h3>
                        <button type="button" class="cookie-modal-close" id="cookie-privacy-close" aria-label="Close modal">&times;</button>
                    </div>
                    <div class="cookie-modal-body">
                        <p><strong>Last Updated: October 2026</strong></p>
                        <p>SecondWare is committed to protecting your privacy. This policy explains how we collect, store, and process information when you browse our appliance catalog and use our online services.</p>
                        
                        <h4 style="color: #fff; margin: 16px 0 8px;">What are cookies?</h4>
                        <p>Cookies are small text files placed on your device to ensure smooth site navigation, remember your cart, secure your session, and analyze our traffic.</p>

                        <h4 style="color: #fff; margin: 16px 0 8px;">How We Use Cookies</h4>
                        <ul style="padding-left: 20px; margin: 0 0 16px;">
                            <li><strong>Essential:</strong> Maintain your login session, cart contents, and secure checkout.</li>
                            <li><strong>Analytics:</strong> Help us measure which appliances and categories are most visited.</li>
                            <li><strong>Marketing:</strong> Serve relevant discounts, notifications, and recommendations.</li>
                        </ul>

                        <p>You can adjust your cookie settings at any time by clicking "Cookies Settings" in the footer of any page.</p>
                    </div>
                    <div class="cookie-modal-footer">
                        <button type="button" class="cookie-modal-btn primary" id="cookie-privacy-ok">Got it</button>
                    </div>
                </div>
            `;
            document.body.appendChild(privacyBackdrop);

            privacyBackdrop.addEventListener('click', (e) => {
                if (e.target === privacyBackdrop) privacyBackdrop.classList.remove('open');
            });
            document.getElementById('cookie-privacy-close').addEventListener('click', () => {
                privacyBackdrop.classList.remove('open');
            });
            document.getElementById('cookie-privacy-ok').addEventListener('click', () => {
                privacyBackdrop.classList.remove('open');
            });
        }

        requestAnimationFrame(() => {
            privacyBackdrop.classList.add('open');
        });
    }

    function setupGlobalReopen() {
        // Expose helpers globally so footer links or developers can invoke them
        window.openCookieSettings = openPreferencesModal;
        window.openPrivacyPolicy = openPrivacyPolicyModal;
        window.resetCookieConsent = function () {
            localStorage.removeItem(COOKIE_CONSENT_KEY);
            localStorage.removeItem(COOKIE_PREFS_KEY);
            const existing = document.getElementById('cookie-consent-banner');
            if (existing) existing.remove();
            renderBanner();
        };

        // Attach to any existing footer cookie links if present
        document.querySelectorAll('[data-cookie-settings], a[href="#cookie-settings"], a[href="#cookies"]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                openPreferencesModal();
            });
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCookieConsent);
    } else {
        initCookieConsent();
    }
})();
