import { useFormik } from 'formik';
import { UserPlus } from "lucide-react";
import React, { useState, useEffect, useRef } from 'react';
import ApiUrlServices from "../../networks/ApiUrlServices";
import AxiosServices from "../../networks/AxiosService";
import CustomButton from "../common/CustomButton/CustomButton";
import InputField from '../InputField/InputField';
import MessageContainer from '../../components/MessageContainer/MessageContainer';

function Register({toggleForm, setMessage}) {
    const [isLoading, setIsLoading] = useState(false);
    const [localMessage, setLocalMessage] = useState({ type: "", message: "" });
    const containerRef = useRef(null);
    
    // Check if this component is being shown in a modal
    const [isInModal, setIsInModal] = useState(false);
    
    useEffect(() => {
        if (containerRef.current) {
            // Check if this component is inside a modal by looking at parent elements
            const checkIfInModal = () => {
                let parent = containerRef.current.parentElement;
                while (parent) {
                    if (parent.className.includes('modal-')) {
                        return true;
                    }
                    parent = parent.parentElement;
                }
                return false;
            };
            
            setIsInModal(checkIfInModal());
        }
    }, []);

    const displayMessage = (msg) => {
        // Only update local message
        setLocalMessage(msg);
        console.log("Setting message:", msg);
    };

    const validateRegisterForm = (values) => {
        const errors = {};

        if (!values.firstName?.trim()) {
            errors.firstName = "First Name is required";
        }
        if (!values.lastName?.trim()) {
            errors.lastName = "Last Name is required";
        }
        if (!values.email?.trim()) {
            errors.email = "Email is required";
        } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
            errors.email = "Invalid email address";
        }

        if (!values.password?.trim()) {
            errors.password = "Password is required";
        } else if (values.password.length < 8) {
            errors.password = "Password must be at least 8 characters";
        } else if (!/[A-Z]/.test(values.password)) {
            errors.password = "Password must contain at least one uppercase letter";
        } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(values.password)) {
            errors.password = "Password must contain at least one special character";
        }

        return errors;
    };

    const registerSubmitForm = async (values) => {
        setIsLoading(true);
        const formData = {
            first_name: values.firstName.trim(),
            last_name: values.lastName.trim(),
            email: values.email.trim(),
            password: values.password.trim(),
        };

        await AxiosServices.post(ApiUrlServices.SIGN_UP, formData).then((response) => {
            displayMessage({message: 'Account created successfully. Please verify your email.', type: "success"});
            toggleForm();
            if (chrome.runtime) {
                chrome.tabs.create({ url: `verify.html?email=${encodeURIComponent(values.email.trim())}` });
            }
        
        }).catch((error) => {
            console.log('Registration error:', error);
            
            const errorData = error.data || {};
            
            console.log('Error data:', errorData);
            
            if (errorData.code === "VALIDATION_ERROR") {
                const errorMessage = errorData.error || 'User with this email already exists.';
                displayMessage({message: errorMessage, type: "error"});
            } 
            else if (errorData.code === "TRY_AGAIN") {
                displayMessage({message: 'Failed to register user. Please try again.', type: "error"});
            }
            else {
                const errorMessage = error.message || 'Registration failed. Please try again later.';
                displayMessage({message: errorMessage, type: "error"});
            }
        }).finally(() => {
            setIsLoading(false);
        });
    };

    const registerForm = useFormik({
        initialValues: {
            firstName: "",
            lastName: "",
            email: "",
            password: "",
        },
        validateOnChange: true,
        validateOnBlur: true,
        validate: validateRegisterForm,
        onSubmit: registerSubmitForm,
    });

    return (
        <div className="form-container" ref={containerRef}>
         
          
            
            <div className="form-card">
                <div className="card-header">
                    <h2 className="card-title">Create an Account</h2>
                    <MessageContainer message={localMessage} />
                </div>
                <div className="card-content">
                    <form className="form" id="registerForm" onSubmit={registerForm.handleSubmit}>
                        <InputField
                            placeholder="Enter First Name"
                            type="text"
                            inputName="firstName"
                            label="First Name"
                            asterisk={true}
                            onBlur={registerForm.handleBlur}
                            value={registerForm.values.firstName}
                            onchangeCallback={registerForm.handleChange}
                            inputClassName={registerForm.touched.firstName && registerForm.errors.firstName ? " is-invalid" : ""}
                            requiredMessage={registerForm.touched.firstName && registerForm.errors.firstName}
                            requiredMessageLabel={registerForm.touched.firstName || registerForm.isSubmitting ? registerForm.errors.firstName : ""}
                        />
                        <InputField
                            placeholder="Enter Last Name"
                            type="text"
                            inputName="lastName"
                            label="Last Name"
                            asterisk={true}
                            onBlur={registerForm.handleBlur}
                            value={registerForm.values.lastName}
                            onchangeCallback={registerForm.handleChange}
                            inputClassName={registerForm.touched.lastName && registerForm.errors.lastName ? " is-invalid" : ""}
                            requiredMessage={registerForm.touched.lastName && registerForm.errors.lastName}
                            requiredMessageLabel={registerForm.touched.lastName || registerForm.isSubmitting ? registerForm.errors.lastName : ""}
                        />
                        <InputField
                            placeholder="Enter Email"
                            type="text"
                            inputName="email"
                            label="Email Address"
                            asterisk={true}
                            onBlur={registerForm.handleBlur}
                            value={registerForm.values.email}
                            onchangeCallback={registerForm.handleChange}
                            inputClassName={registerForm.touched.email && registerForm.errors.email ? " is-invalid" : ""}
                            requiredMessage={registerForm.touched.email && registerForm.errors.email}
                            requiredMessageLabel={registerForm.touched.email || registerForm.isSubmitting ? registerForm.errors.email : ""}
                        />
                        <InputField
                            placeholder="Enter Password"
                            type="password"
                            inputName="password"
                            label="Enter Password"
                            asterisk={true}
                            onBlur={registerForm.handleBlur}
                            value={registerForm.values.password}
                            onchangeCallback={registerForm.handleChange}
                            inputClassName={registerForm.touched.password && registerForm.errors.password ? " is-invalid" : ""}
                            requiredMessage={registerForm.touched.password && registerForm.errors.password}
                            requiredMessageLabel={registerForm.touched.password || registerForm.isSubmitting ? registerForm.errors.password : ""}
                        />

                        <CustomButton
                            disabled={isLoading}
                            isLoading={isLoading}
                            groupIcon={<UserPlus className="input-icon" size={15}/>}
                            fullWidth
                            loadingText="Creating Account..."
                            type="submit"
                        >
                            Create Account
                        </CustomButton>

                        <div className="register-prompt">
                            Already have an account?{' '}
                            <a href="#login" onClick={toggleForm} className="register-link">
                                Login now
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Register;
