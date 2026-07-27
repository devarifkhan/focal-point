import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserService from "../../services/userService";
import Path from "../../networks/path";

const ResendOTP = ({ email, autoResendDone }) => {
    const [isResendLoading, setIsResendLoading] = useState(false);
    const [countdown, setCountdown] = useState(600); // 10 minutes
    const navigate = useNavigate();

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

    useEffect(() => {
        if (autoResendDone) {
            setCountdown(600); // Reset countdown when auto resend is done
        }
    }, [autoResendDone]);

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    };

    const handleResendOTP = async (e) => {
        e.preventDefault();
        setIsResendLoading(true);
        try {
            const response = await UserService.resendOTP(email || "");
            if (response.code === "OTP_RESENT") {
                toast.success(response.message);
                setCountdown(600); // Reset to 10 minutes
            }
        } catch (error) {
            const errorData = error.response?.data;
            if (errorData?.code === "USER_NOT_FOUND") {
                toast.error(errorData.message);
            } else if (errorData?.code === "ALREADY_VERIFIED") {
                toast.error(errorData.message);
                navigate(Path.signIn);
            } else {
                toast.error("Failed to resend OTP. Please try again.");
            }
        } finally {
            setIsResendLoading(false);
        }
    };

    return (
        <div className="resend-prompt text-center">
            {countdown > 0 ? (
                <span className="text-muted">Resend OTP in {formatTime(countdown)}</span>
            ) : (
                <div className="resend-link-container">
                    Didn't receive the code?{" "}
                    <a 
                        href="#resend" 
                        onClick={handleResendOTP} 
                        className="resend-link" 
                        style={{ pointerEvents: isResendLoading ? "none" : "auto" }}
                    >
                        Resend OTP {isResendLoading && <Loader2 className="loader-icon" size={16} />}
                    </a>
                </div>
            )}
        </div>
    );
};

export default ResendOTP;