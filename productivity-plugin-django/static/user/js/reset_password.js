// Password visibility toggle function
function togglePasswordVisibility(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const toggleIcon = document.getElementById(toggleId);

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleIcon.src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%237e8389' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'%3E%3C/path%3E%3Ccircle cx='12' cy='12' r='3'%3E%3C/circle%3E%3C/svg%3E";
    } else {
        passwordInput.type = "password";
        toggleIcon.src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%237e8389' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'%3E%3C/path%3E%3Cline x1='1' y1='1' x2='23' y2='23'%3E%3C/line%3E%3C/svg%3E";
    }
}

// Make togglePasswordVisibility available globally
window.togglePasswordVisibility = togglePasswordVisibility;

document.addEventListener('DOMContentLoaded',(e)=>{
    e.preventDefault();
    let currentUrl = new URL(window.location.href)
    let params = new URLSearchParams(currentUrl.search)
    let token = params.get('token')
    let form = document.getElementById('from')
    let submitBtn = document.getElementById('submit')
    let password1Input = document.getElementById('password')
    let password2Input = document.getElementById('confrim_password')
    let password1Validation = document.getElementById('password-validation')
    let password2Validation = document.getElementById('confirm-password-validation')

    function setLoadingState(isLoading) {
        const spinner = submitBtn.querySelector('.spinner');
        if (isLoading) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            spinner.style.display = 'inline-block';
        } else {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            spinner.style.display = 'none';
        }
    }

    function validatePassword(password) {
        if (!password) {
            return "Password is required";
        }
        if (password.length < 8) {
            return "Password must be at least 8 characters";
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            return "Password must contain at least one uppercase, lowercase, and digit";
        }
        return "";
    }

    function validateConfirmPassword(password1, password2) {
        if (!password2) {
            return "Confirm password is required";
        }
        if (password1 !== password2) {
            return "Passwords do not match";
        }
        return "";
    }

    function showValidation(input, validationDiv, message) {
        if (message) {
            input.classList.add('error');
            validationDiv.style.display = 'block';
            validationDiv.textContent = message;
        } else {
            input.classList.remove('error');
            validationDiv.style.display = 'none';
            validationDiv.textContent = '';
        }
    }

    // Initialize validation divs as hidden
    password1Validation.style.display = 'none';
    password2Validation.style.display = 'none';

    // Validate on input blur
    password1Input.addEventListener('blur', () => {
        const message = validatePassword(password1Input.value);
        showValidation(password1Input, password1Validation, message);
    });

    password2Input.addEventListener('blur', () => {
        const message = validateConfirmPassword(password1Input.value, password2Input.value);
        showValidation(password2Input, password2Validation, message);
    });

    // Validate on input change
    password1Input.addEventListener('input', () => {
        const message = validatePassword(password1Input.value);
        showValidation(password1Input, password1Validation, message);
        
        // Also update confirm password validation if it has a value
        if (password2Input.value) {
            const confirmMessage = validateConfirmPassword(password1Input.value, password2Input.value);
            showValidation(password2Input, password2Validation, confirmMessage);
        }
    });

    password2Input.addEventListener('input', () => {
        const message = validateConfirmPassword(password1Input.value, password2Input.value);
        showValidation(password2Input, password2Validation, message);
    });
    

    submitBtn.addEventListener('click',(e)=>{
        e.preventDefault();
        let password1 = password1Input.value
        let password2 = password2Input.value
        
        // Validate both passwords
        const password1Error = validatePassword(password1);
        const password2Error = validateConfirmPassword(password1, password2);
        
        showValidation(password1Input, password1Validation, password1Error);
        showValidation(password2Input, password2Validation, password2Error);

        if (password1Error || password2Error) {
            return false;
        }

        // Start loading
        setLoadingState(true);

        let formdata = new FormData()
        formdata.append('password1',password1)
        formdata.append('password2',password2)
        formdata.append('token',token)
        let sendUrl = currentUrl.origin+ '/user/' +'confirm_reset_password'
        let csrf_token = Cookies.get('csrftoken')
        axios.post(sendUrl, formdata, {
            headers: {
              'X-CSRFToken': csrf_token
            }
        }).then((res)=>{
            const container = document.getElementById('container');
            const messageDiv = document.createElement('div');
            messageDiv.style.textAlign = 'center';
            messageDiv.style.padding = '20px';
            if(res.status === 200){
                if(res.data.success){
                    messageDiv.innerHTML = `
                        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="32" cy="32" r="32" fill="#4CAF50" fill-opacity="0.1"/>
                            <path d="M27.5 34.5L21 28L18 31L27.5 40.5L46 22L43 19L27.5 34.5Z" fill="#4CAF50"/>
                        </svg>
                        <h3 style="color: #4CAF50; margin: 16px 0;">${res.data.message}</h3>
                    `;
                    form.remove();
                    container.appendChild(messageDiv);
                    setTimeout(() => {
                        window.close();
                    }, 2000);
                } else {
                    messageDiv.innerHTML = `
                        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="32" cy="32" r="32" fill="#FF5252" fill-opacity="0.1"/>
                            <path d="M40 26.4L37.6 24L32 29.6L26.4 24L24 26.4L29.6 32L24 37.6L26.4 40L32 34.4L37.6 40L40 37.6L34.4 32L40 26.4Z" fill="#FF5252"/>
                        </svg>
                        <h3 style="color: #FF5252; margin: 16px 0;">${res.data.message}</h3>
                        <a href="${window.location.href}" style="color: #EA484F; text-decoration: underline;">Try Again</a>
                    `;
                    form.remove();
                    container.appendChild(messageDiv);
                }
            } else {
                messageDiv.innerHTML = `
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="32" cy="32" r="32" fill="#FFC107" fill-opacity="0.1"/>
                        <path d="M32 24V36M32 40V44M32 8C18.745 8 8 18.745 8 32C8 45.255 18.745 56 32 56C45.255 56 56 45.255 56 32C56 18.745 45.255 8 32 8Z" stroke="#FFC107" stroke-width="2"/>
                    </svg>
                    <h3 style="color: #FFC107; margin: 16px 0;">Try Again Later</h3>
                `;
                form.remove();
                container.appendChild(messageDiv);
            }
        }).catch((err)=>{
            console.log(err)
            // Stop loading on error
            setLoadingState(false);
        })
    })
})