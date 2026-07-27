import { useFormik } from "formik";
import { CheckCircle } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import CustomButton from "../../components/common/CustomButton/CustomButton";
import InputField from "../../components/InputField/InputField";
import UserService from "../../services/userService";
import Path from "../../networks/path";

const VerifyOTP = ({ email, onResendOTP }) => {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

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
        try {
            const response = await UserService.verifyOTP(email, values.otp.trim());
            if (response.code === "VERIFIED") {
                toast.success(response.message);
                navigate(Path.signIn);
            }
        } catch (error) {
            const errorData = error.response?.data;
            if (errorData?.code === "INVALID_OTP") {
                otpForm.setErrors({ otp: errorData.message });
            } else if (errorData?.code === "OTP_EXPIRED") {
                otpForm.setErrors({ otp: errorData.message });
            } else {
                otpForm.setErrors({ otp: "Failed to verify OTP. Please try again." });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const otpForm = useFormik({
        initialValues: { otp: "" },
        validateOnChange: true,
        validateOnBlur: true,
        validate: validateOTPForm,
        onSubmit: otpSubmitForm,
    });

    return (
        <form onSubmit={otpForm.handleSubmit}>
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
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                <CustomButton 
                    disabled={isLoading} 
                    isLoading={isLoading} 
                    groupIcon={<CheckCircle className="input-icon" size={15} />} 
                    fullWidth 
                    loadingText="Verifying..." 
                    type="submit"
                >
                    Verify OTP
                </CustomButton>
            </div>
        </form>
    );
};

export default VerifyOTP;