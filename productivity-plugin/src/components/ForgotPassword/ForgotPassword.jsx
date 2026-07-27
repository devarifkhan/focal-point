import { useFormik } from 'formik';
import React, { useState, useEffect, useRef } from 'react';
import ApiUrlServices from "../../networks/ApiUrlServices";
import AxiosServices from "../../networks/AxiosService";
import CustomButton from "../common/CustomButton/CustomButton";
import InputField from '../InputField/InputField';
import MessageContainer from '../../components/MessageContainer/MessageContainer';

function ForgotPassword({goBackToLogin, setMessage}) {
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

    // Helper function to display messages
    const displayMessage = (msg) => {
        // Only update local message
        setLocalMessage(msg);
    };

    const forgotPasswordFormValidation = (values) => {
        const errors = {};
        if (!values.email?.trim()) {
            errors.email = "Email is required";
        } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
            errors.email = "Invalid email address";
        }

        return errors;
    };

    const forgotPasswordSubmitForm = async (values) => {
        setIsLoading(true)
        const formData = {
            email: values.email.trim(),
        };

        AxiosServices.post(ApiUrlServices.FORGET_PASSWORD, formData).then((response) => {
            if(response.data.code === "SUCCESS"){
                displayMessage({message: 'Password reset link sent to your email.', type: "success"});
                goBackToLogin();
            }
        }).catch((error) => {
            // Log the entire error object to see its structure
            console.log('Forgot password error:', error);
            
            // The error object should contain data from the API response
            const errorData = error.data || {};
            
            // Log the error data for debugging
            console.log('Error data:', errorData);
            
            if (errorData.code === "NOT_EXISTS") {
                displayMessage({message: 'The email is not registered.', type: "error"});
            } 
            else {
                // Use the specific error message from API if available
                const errorMessage = errorData.error || errorData.message || error.message || 'Failed to send password reset link. Please try again.';
                displayMessage({message: errorMessage, type: "error"});
            }
        }).finally(() => {
            setIsLoading(false);
        });
    }

    const forgotPasswordForm = useFormik({
        initialValues: {
            email: "",
        },
        validateOnChange: true,
        validateOnBlur: true,
        validate: forgotPasswordFormValidation,
        onSubmit: forgotPasswordSubmitForm,
    });

    return (
        <div className="form-container" ref={containerRef}>
            <div className="form-card">
                <div className="card-header">
                    <h2 className="card-title">Forget Password</h2>
                    <MessageContainer message={localMessage} />
                </div>
                <div className="card-content">
                    <form className="form" id="resetForm" onSubmit={forgotPasswordForm.handleSubmit}>
                        <InputField
                            placeholder="Enter Email"
                            type="text"
                            inputName="email"
                            label="Email Address"
                            asterisk={true}
                            onBlur={forgotPasswordForm.handleBlur}
                            value={forgotPasswordForm.values.email}
                            onchangeCallback={forgotPasswordForm.handleChange}
                            inputClassName={forgotPasswordForm.touched.email && forgotPasswordForm.errors.email ? " is-invalid" : ""}
                            requiredMessage={forgotPasswordForm.touched.email && forgotPasswordForm.errors.email}
                            requiredMessageLabel={forgotPasswordForm.touched.email || forgotPasswordForm.isSubmitting ? forgotPasswordForm.errors.email : ""}
                        />
                        <CustomButton
                            disabled={isLoading}
                            isLoading={isLoading}
                            fullWidth
                            loadingText="Sending Request"
                            type="submit"
                        >
                            Send Request
                        </CustomButton>

                        <div className="register-prompt">
                            Already have an account?{' '}
                            <a href="#backToLogin" onClick={goBackToLogin} className="register-link">
                                Back to Login
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;