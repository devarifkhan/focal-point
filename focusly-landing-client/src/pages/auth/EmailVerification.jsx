import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../assets/css/verify.css";
import VerifyOTP from "./VerifyOTP";
import ResendOTP from "./ResendOTP";
import Path from "../../networks/path";
import UserService from "../../services/userService";

function Verify() {
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get("email");
    const token = localStorage.getItem("access_token");
    const navigate = useNavigate();
    const [autoResendDone, setAutoResendDone] = useState(false);

    useEffect(() => {
        if (token) {
            navigate(Path.dashboard);
        }
    }, [token, navigate]);

    useEffect(() => {
        const autoResendOTP = async () => {
            if (email && !autoResendDone) {
                try {
                    const response = await UserService.resendOTP(email);
                    if (response.code === "OTP_RESENT") {
                        toast.success("Verification code sent to your email");
                    }
                } catch (error) {
                    console.error("Auto resend failed:", error);
                }
                setAutoResendDone(true);
            }
        };
        
        autoResendOTP();
    }, [email, autoResendDone]);

    return (
        <div className="form-container">
            <h2 className="card-title">Verify Your Email</h2>
            <p className="text-center card-description">
                We've sent a verification code to
                <br />
                <strong>{email || "your email address"}</strong>
            </p>
            <div className="form">
                <VerifyOTP email={email} />
                <ResendOTP email={email} autoResendDone={autoResendDone} />
            </div>
        </div>
    );
}

export default Verify;
