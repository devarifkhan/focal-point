import { useFormik } from "formik";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import CustomButton from "../../components/common/CustomButton/CustomButton";
import InputField from "../../components/InputField/InputField";
import ApiUrlServices from "../../networks/ApiUrlServices";
import AxiosServices from "../../networks/AxiosService";
import Path from "../../networks/path";

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

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
        setIsLoading(true);
        const formData = {
            email: values.email.trim(),
        };

        AxiosServices.post(ApiUrlServices.FORGET_PASSWORD, formData)
            .then((response) => {
                if (response.data.code === "SUCCESS") {
                    setSuccessMessage("Password Reset Link Sent Successfully");
                    setTimeout(() => setSuccessMessage(""), 3000);
                }
            })
            .catch((error) => {
                if (error.response.data.code == "NOT_EXISTS") {
                    forgotPasswordForm.setFieldError("email", "The email is not registerd.");
                } else {
                    toast.error("Something went wrong");
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

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
        <div className="form-container">
            <div className="form-card">
                <div className="card-header">
                    <h2 className="card-title">Forget Password</h2>
                    {successMessage && (
                        <div className="success-message">
                            ✓ {successMessage}
                        </div>
                    )}
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
                        <CustomButton disabled={isLoading} isLoading={isLoading} fullWidth loadingText="Sending Request" type="submit">
                            Send Request
                        </CustomButton>

                        <div className="register-prompt">
                            Already have an account?{" "}
                            <button type="button" onClick={() => navigate(Path.signIn)} className="register-link">
                                Back to Login
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
