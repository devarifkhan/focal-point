import { useFormik } from "formik";
import { CheckCircle, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import "../../assets/css/verify.css";
import CustomButton from "../../components/common/CustomButton/CustomButton";
import Header from "../../components/Header/Header";
import InputField from "../../components/InputField/InputField";
import MessageContainer from "../../components/MessageContainer/MessageContainer";
import ApiUrlServices from "../../networks/ApiUrlServices";
import AxiosServices from "../../networks/AxiosService";

function Verify() {
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get("email");
    const [isLoading, setIsLoading] = useState(false);
    const [isResendLoading, setIsResendLoading] = useState(false);
    const [countdown, setCountdown] = useState(20);
    const [message, setMessage] = useState({ type: "", message: "" });
    const [token, setToken] = useState(localStorage.getItem("access_token"));

    useEffect(() => {
        if (token) {
            if (chrome.runtime && chrome.runtime.openOptionsPage) {
                window.location.href = "options.html";
            }
        }
    }, []);

    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [countdown]);

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    };

    const validateOTPForm = (values) => {
        const errors = {};
        if (!values.otp?.trim()) {
            errors.otp = "OTP is required";
        } else if (values.otp.length !== 6) {
            errors.otp = "OTP must be 6 digits";
        } else if (!/^\d+$/.test(values.otp)) {
            errors.otp = "OTP must contain only numbers";
        }
        return errors;
    };

    const otpSubmitForm = async (values) => {
        setIsLoading(true);
        const payload = {
            email: email,
            code: values.otp.trim(),
        };
        AxiosServices.post(ApiUrlServices.VERIFY_OTP, payload)
            .then(() => {
                setMessage({ message: "Email verified successfully. Please login to continue.", type: "success" });
                // setTimeout(() => {
                //     window.location.href = "popup.html";
                // }, 200);

                    setTimeout(() => {
                    if(chrome.runtime){
                        chrome.tabs.getCurrent((currentTab) => {
                            if (currentTab) {
                                chrome.tabs.remove(currentTab.id);
                            }
                        });

                    }

                }, 2000);

                // chrome.action.openPopup(() => {
                //     console.log("Popup opened");
                // });
            })
            .catch((error) => {
                if (error.response?.data?.code === "INVALID_OTP") {
                    setMessage({ message: "Invalid OTP. Please try again.", type: "error" });
                } else {
                    setMessage({ message: "Failed to verify OTP. Please try again.", type: "error" });
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    const handleResendOTP = async (e) => {
        e.preventDefault();
        setIsResendLoading(true);
        const payload = {
            email: email || "",
        };

        AxiosServices.post(ApiUrlServices.RESEND_OTP, payload)
            .then(() => {
                setMessage({ message: "OTP resent successfully", type: "success" });
                setCountdown(120);
            })
            .catch((error) => {
                setMessage({ message: "Failed to resend OTP. Please try again.", type: "error" });
            })
            .finally(() => {
                setIsResendLoading(false);
            });
    };

    const otpForm = useFormik({
        initialValues: {
            otp: "",
        },
        validateOnChange: true,
        validateOnBlur: true,
        validate: validateOTPForm,
        onSubmit: otpSubmitForm,
    });

    return (
        <div className="verify-container">
            <div className="main-container">
                <Header />
                <div className="main-content">
                    <MessageContainer message={message} />
                    <div className="form-container">
                        <h2 className="card-title">Verify Your Email</h2>
                        <p className="text-center card-description">
                            We've sent a verification code to
                            <br />
                            <strong>{email || "your email address"}</strong>
                        </p>
                        <form className="form" id="otpForm" onSubmit={otpForm.handleSubmit}>
                            <InputField
                                placeholder="Enter 6-digit OTP"
                                type="text"
                                inputName="otp"
                                label="Verification Code"
                                asterisk={true}
                                onBlur={otpForm.handleBlur}
                                value={otpForm.values.otp}
                                onchangeCallback={otpForm.handleChange}
                                inputClassName={otpForm.touched.otp && otpForm.errors.otp ? " is-invalid" : ""}
                                requiredMessage={otpForm.touched.otp && otpForm.errors.otp}
                                requiredMessageLabel={otpForm.touched.otp || otpForm.isSubmitting ? otpForm.errors.otp : ""}
                                maxLength={6}
                            />

                            <CustomButton disabled={isLoading} isLoading={isLoading} groupIcon={<CheckCircle className="input-icon" size={15} />} fullWidth loadingText="Verifying..." type="submit">
                                Verify OTP
                            </CustomButton>

                            <div className="resend-prompt text-center">
                                {countdown > 0 ? (
                                    <span className="text-muted">Resend OTP in {formatTime(countdown)}</span>
                                ) : (
                                    <div className="resend-link-container">
                                        Didn't receive the code?{" "}
                                        <a href="#resend" onClick={handleResendOTP} className="resend-link" style={{ pointerEvents: isResendLoading ? "none" : "auto" }}>
                                            Resend OTP {isResendLoading && <Loader2 className="loader-icon" size={16} />}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Verify;
