import { useFormik } from 'formik';
import { UserPlus } from "lucide-react";
import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import CustomButton from "../../components/common/CustomButton/CustomButton";
import InputField from '../../components/InputField/InputField';
import ApiUrlServices from "../../networks/ApiUrlServices";
import AxiosServices from "../../networks/AxiosService";
import Path from "../../networks/path";

function Register() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

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

        AxiosServices.post(ApiUrlServices.SIGN_UP, formData).then((response) => {
            navigate(`${Path.emailVerification}?email=${encodeURIComponent(values.email)}`);
        }).catch((error) => {
            if (error.response.data.code==="VALIDATION_ERROR") {
                registerForm.setFieldError("email", "User with this email already exists.");
            } 
            if(error.response.data.code==="TRY_AGAIN"){
                registerForm.setFieldError("email", "Failed to register user. Please try again.");
            }
        }).finally(()=>{
            setIsLoading(false)
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
        <div className="form-container">
            <div className="form-card">
                <div className="card-header">
                    <h2 className="card-title">Create an Account</h2>
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
                            Already have an account?{" "}
                            <button type="button" onClick={() => navigate(Path.signIn)} className="register-link">
                                Login now
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Register;