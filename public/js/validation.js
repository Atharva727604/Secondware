// ==========================================
// FORM VALIDATION UTILITIES
// ==========================================

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number (Indian format: 10 digits)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone number
 */
function isValidPhone(phone) {
    const phoneRegex = /^[6-9]\d{9}$/; // Indian phone numbers start with 6-9 and have 10 digits
    return phoneRegex.test(phone.replace(/\D/g, ''));
}

/**
 * Validate if input is a positive number
 * @param {string|number} value - Value to validate
 * @returns {boolean} - True if valid positive number
 */
function isValidPositiveNumber(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
}

/**
 * Validate if input is a valid integer
 * @param {string|number} value - Value to validate
 * @returns {boolean} - True if valid integer
 */
function isValidInteger(value) {
    const num = parseInt(value);
    return !isNaN(num) && num > 0 && Number.isInteger(num);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - Object with isValid, message, and strength
 */
function validatePassword(password) {
    const requirements = [
        { regex: /.{8,}/, message: 'At least 8 characters' },
        { regex: /[A-Z]/, message: 'At least one uppercase letter' },
        { regex: /[a-z]/, message: 'At least one lowercase letter' },
        { regex: /[0-9]/, message: 'At least one number' },
        { regex: /[^A-Za-z0-9]/, message: 'At least one special character' }
    ];

    const failedRequirements = requirements.filter(req => !req.regex.test(password));

    let strength = 'Weak';
    let strengthColor = '#d32f2f';

    const passedCount = requirements.length - failedRequirements.length;

    if (passedCount === requirements.length) {
        strength = 'Strong';
        strengthColor = '#2e7d32';
    } else if (passedCount >= 3) {
        strength = 'Medium';
        strengthColor = '#f57c00';
    }

    if (failedRequirements.length > 0) {
        return {
            isValid: false,
            message: 'Password must have: ' + failedRequirements.map(r => r.message).join(', '),
            strength,
            strengthColor,
            passedCount
        };
    }

    return {
        isValid: true,
        message: 'Password is strong',
        strength,
        strengthColor,
        passedCount
    };
}

/**
 * Validate name (non-empty, no special characters)
 * @param {string} name - Name to validate
 * @returns {boolean} - True if valid name
 */
function isValidName(name) {
    const nameRegex = /^[a-zA-Z\s'-]{2,50}$/;
    return nameRegex.test(name.trim());
}

/**
 * Validate product name (more permissive, up to 255 chars)
 * @param {string} name - Product name to validate
 * @returns {boolean} - True if valid product name
 */
function isValidProductName(name) {
    const trimmed = name.trim();
    return trimmed.length > 0;
}

/**
 * Validate address (non-empty, minimum length)
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid address
 */
function isValidAddress(address) {
    return address.trim().length >= 5;
}

/**
 * Add validation feedback to an input field
 * @param {HTMLElement} inputElement - Input element to add validation to
 * @param {boolean} isValid - Whether the input is valid
 * @param {string} errorMessage - Error message to display
 */
function showValidationFeedback(inputElement, isValid, errorMessage = '') {
    const container = inputElement.parentElement;

    // Remove existing error message
    const existingError = container.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    if (!isValid && errorMessage) {
        inputElement.classList.add('input-error');
        inputElement.classList.remove('input-valid');

        const errorSpan = document.createElement('span');
        errorSpan.className = 'error-message';
        errorSpan.textContent = errorMessage;
        errorSpan.style.cssText = `
            display: block;
            color: #d32f2f;
            font-size: 0.85em;
            margin-top: 5px;
        `;
        container.appendChild(errorSpan);
    } else if (isValid) {
        inputElement.classList.remove('input-error');
        inputElement.classList.add('input-valid');
    } else {
        inputElement.classList.remove('input-error');
        inputElement.classList.remove('input-valid');
    }
}

/**
 * Add real-time email validation to an input
 * @param {string} inputId - ID of the email input element
 */
function setupEmailValidation(inputId) {
    const emailInput = document.getElementById(inputId);
    if (!emailInput) return;

    emailInput.addEventListener('blur', () => {
        const email = emailInput.value.trim();
        if (email) {
            const isValid = isValidEmail(email);
            showValidationFeedback(emailInput, isValid, isValid ? '' : 'Please enter a valid email address');
        }
    });

    emailInput.addEventListener('input', () => {
        const email = emailInput.value.trim();
        if (emailInput.classList.contains('input-error') && email) {
            const isValid = isValidEmail(email);
            if (isValid) {
                emailInput.classList.remove('input-error');
                const errorMsg = emailInput.parentElement.querySelector('.error-message');
                if (errorMsg) errorMsg.remove();
            }
        }
    });
}

/**
 * Add real-time phone validation to an input
 * @param {string} inputId - ID of the phone input element
 */
function setupPhoneValidation(inputId) {
    const phoneInput = document.getElementById(inputId);
    if (!phoneInput) return;

    phoneInput.addEventListener('blur', () => {
        const phone = phoneInput.value.trim();
        if (phone) {
            const isValid = isValidPhone(phone);
            showValidationFeedback(phoneInput, isValid, isValid ? '' : 'Please enter a valid 10-digit phone number');
        }
    });

    phoneInput.addEventListener('input', () => {
        const phone = phoneInput.value.trim();
        if (phoneInput.classList.contains('input-error') && phone) {
            const isValid = isValidPhone(phone);
            if (isValid) {
                phoneInput.classList.remove('input-error');
                const errorMsg = phoneInput.parentElement.querySelector('.error-message');
                if (errorMsg) errorMsg.remove();
            }
        }
    });
}

/**
 * Add real-time number validation to an input
 * @param {string} inputId - ID of the number input element
 * @param {boolean} integerOnly - If true, only allow integers
 */
function setupNumberValidation(inputId, integerOnly = false) {
    const numberInput = document.getElementById(inputId);
    if (!numberInput) return;

    numberInput.addEventListener('blur', () => {
        const value = numberInput.value.trim();
        if (value) {
            const isValid = integerOnly ? isValidInteger(value) : isValidPositiveNumber(value);
            const errorMsg = integerOnly ? 'Please enter a valid whole number' : 'Please enter a valid number';
            showValidationFeedback(numberInput, isValid, isValid ? '' : errorMsg);
        }
    });

    numberInput.addEventListener('input', () => {
        const value = numberInput.value.trim();
        // Remove error class if user is correcting their input
        if (numberInput.classList.contains('input-error') && value) {
            const isValid = integerOnly ? isValidInteger(value) : isValidPositiveNumber(value);
            if (isValid) {
                numberInput.classList.remove('input-error');
                const errorMsg = numberInput.parentElement.querySelector('.error-message');
                if (errorMsg) errorMsg.remove();
            }
        }
    });
}

/**
 * Validate entire form and return results
 * @param {HTMLElement} formElement - Form element to validate
 * @param {object} validationRules - Object with field IDs as keys and validation functions as values
 * @returns {object} - Object with isValid boolean and errors array
 */
function validateForm(formElement, validationRules) {
    const errors = {};
    let isValid = true;

    for (const [fieldId, validationFn] of Object.entries(validationRules)) {
        const field = document.getElementById(fieldId);
        if (!field) continue;

        const value = field.value.trim();
        const result = validationFn(value);

        if (typeof result === 'boolean') {
            if (!result) {
                isValid = false;
                errors[fieldId] = 'Invalid input';
            }
        } else if (result && result.isValid === false) {
            isValid = false;
            errors[fieldId] = result.message;
        }
    }

    return { isValid, errors };
}

/**
 * Escape HTML characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
