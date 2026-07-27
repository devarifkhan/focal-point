import {useFormik} from "formik";
import {LogIn} from "lucide-react";
import React, {useState} from "react";
import {useNavigate} from "react-router-dom";
import InputField from "../../components/InputField/InputField";
import CustomButton from "../../components/common/CustomButton/CustomButton";
import {sessionData} from "../../config/sessionKeys";
import ApiUrlServices from "../../networks/ApiUrlServices";
import AxiosServices from "../../networks/AxiosService";
import Path from "../../networks/path";
import UserService from "../../services/userService";

function Login() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);


    const validateLoginForm = (values) => {
        const errors = {};
        if (!values.email?.trim()) {
            errors.email = "Email is required";
        }

        if (!values.password.trim()) {
            errors.password = "Password is required";
        } else if (values.password.trim().length < 6) {
            errors.password = "Password must be at least 6 characters";
        }

        return errors;
    };



    const loginSubmitForm = async (values) => {
        setIsLoading(true);
        const formData = {
            email: values.email.trim(),
            password: values.password.trim(),
        };

        AxiosServices.post(ApiUrlServices.SIGN_IN, formData)
            .then(async (response) => {
                localStorage.setItem("access_token", response.data.data.access_token);
                localStorage.setItem(sessionData, JSON.stringify(response.data.data));
                
                // Fetch latest plan config after login
                try {
                    await UserService.getPlanConfig();
                } catch (error) {
                    console.error('Failed to fetch plan config:', error);
                }
                
                const redirectTo = localStorage.getItem('redirectTo');
                if (redirectTo) {
                    localStorage.removeItem('redirectTo');
                    navigate(redirectTo);
                } else {
                    navigate(Path.dashboard);
                }
            })
            .catch((error) => {
                if (error.response.data.code === "INVALID_CREDENTIAL") {
                    loginForm.setFieldError("password", "Email or password is incorrect.");
                } else if (error.response.data.code === "WRONG_PASSWORD") {
                    loginForm.setFieldError("password", "Password is incorrect.");
                } else if (error.response.data.code === "USER_NOT_FOUND") {
                    loginForm.setFieldError("email", "User does not exist.");
                } else if (error.response.data.code === "EMAIL_NOT_VERIFIED") {
                    navigate(`${Path.emailVerification}?email=${encodeURIComponent(values.email)}`);
                }
                // console.log(error.response)
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    const loginForm = useFormik({
        initialValues: {
            email: "",
            password: "",
        },
        validateOnChange: true,
        validateOnBlur: true,
        validate: validateLoginForm,
        onSubmit: loginSubmitForm,
    });

    return (
        <div className="form-container">
            <div className="form-card">
                <div className="card-header">
                    <h2 className="card-title">Login to Your Account</h2>
                </div>
                <div className="card-content">
                    <form className="form" id="loginForm" onSubmit={loginForm.handleSubmit}>
                        <InputField
                            placeholder="Enter Email"
                            type="text"
                            inputName="email"
                            label="Email Address"
                            asterisk={true}
                            onBlur={loginForm.handleBlur}
                            value={loginForm.values.email}
                            onchangeCallback={loginForm.handleChange}
                            inputClassName={`${loginForm.touched.email && loginForm.errors.email ? " is-invalid" : ""}`}
                            requiredMessage={loginForm.touched.email && loginForm.errors.email}
                            requiredMessageLabel={loginForm.touched.email || loginForm.isSubmitting ? loginForm.errors.email : ""}
                        />


                        <InputField
                            placeholder="Enter Password"
                            type="password"
                            inputName="password"
                            label="Password"
                            asterisk={true}
                            onBlur={loginForm.handleBlur}
                            value={loginForm.values.password}
                            onchangeCallback={loginForm.handleChange}
                            inputClassName={`${loginForm.touched.password && loginForm.errors.password ? " is-invalid" : ""}`}
                            requiredMessage={loginForm.touched.password && loginForm.errors.password}
                            requiredMessageLabel={loginForm.touched.password || loginForm.isSubmitting ? loginForm.errors.password : ""}
                        />
                        <div className="form-footer">
                            <button type="button" onClick={() => navigate(Path.forgotPassword)}
                                    className="forgot-password">
                                Forgot password?
                            </button>
                        </div>

                        <CustomButton disabled={isLoading} isLoading={isLoading}
                                      groupIcon={<LogIn className="input-icon" size={15}/>} fullWidth
                                      loadingText="Signing In..." type="submit">
                            Sign In
                        </CustomButton>

                        <div className="register-prompt">
                            Don't have an account?{" "}
                            <button type="button" onClick={() => navigate(Path.signUp)} className="register-link">
                                Register now
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;
