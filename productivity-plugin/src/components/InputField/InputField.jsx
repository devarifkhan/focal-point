import React, { forwardRef } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import "./../../assets/css/index.css";

const InputField = forwardRef(({
    placeholder,
    type,
    inputName,
    label,
    asterisk = false,
    onchangeCallback,
    onkeyupCallback,
    onBlur,
    value,
    disabled = false,
    inputClassName = "",
    requiredMessage = "",
    requiredMessageLabel = "",
    warningMessage = "",
    description = "",
    tooltip = "",
}, ref) => {
    // State for password visibility
    const [showPassword, setShowPassword] = React.useState(false);

    // Function to toggle password visibility
    const toggleShowPassword = () => {
        setShowPassword(!showPassword);
    };

    // Determine the actual input type for password fields
    const actualType = type === "password" ? (showPassword ? "text" : "password") : type;

    return (
        <div className="form-group">
            {label && (
                <label htmlFor={inputName} className="form-label">
                    {label} {asterisk && <span className="asterisk">*</span>}
                </label>
            )}
            
            <div className="input-wrapper" style={{ position: "relative" }}>
                <div className={tooltip ? "button-with-tooltip" : ""} style={{ width: "100%" }}>
                    <input
                        type={actualType}
                        name={inputName}
                        id={inputName}
                        className={`form-input ${inputClassName}`}
                        placeholder={placeholder}
                        value={type !== "file" ? value : undefined}
                        onChange={onchangeCallback}
                        onKeyUp={onkeyupCallback}
                        onBlur={onBlur}
                        disabled={disabled}
                        ref={ref}
                    />
                    {tooltip && (
                        <span className="custom-tooltip">{tooltip}</span>
                    )}
                </div>

                {/* Show eye icon for password fields */}
                {type === "password" && (
                    <div className="password-visiablity" onClick={toggleShowPassword}>
                        {showPassword ? <Eye /> : <EyeOff />}
                    </div>
                )}
            </div>

            {/* Show description if provided */}
            {description && <div className="input-description">{description}</div>}

            {/* Show error message if provided */}
            {requiredMessage && (
                <span className="error-message" style={{
                    color: (requiredMessageLabel?.includes('blocked immediately') || requiredMessageLabel?.includes('Time should be greater than used time')) ? '#ff9800' : '#ea484f'
                }}>
                    <AlertCircle size={14} /> {requiredMessageLabel}
                </span>
            )}

            {/* Show warning message if provided and no error */}
            {!requiredMessage && warningMessage && (
                <span className="warning-message" style={{
                    color: '#ff9800',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '4px'
                }}>
                    <AlertCircle size={14} /> {warningMessage}
                </span>
            )}
        </div>
    );
});

export default InputField;