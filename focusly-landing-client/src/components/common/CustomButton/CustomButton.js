import React from 'react';
import {Loader2} from 'lucide-react';

const CustomButton = ({
                    children,
                    type = 'button',
                    className = '',
                    isLoading = false,
                    disabled = false,
                    onClick,
                    fullWidth = false,
                    loadingText = '',
                    groupIcon,
                    ...props
                }) => {
    const isDisabled = disabled || isLoading;

    const handleClick = (e) => {
        if (!isLoading && !disabled && onClick) {
            onClick(e);
        }
    };

    return (
        <button
            type={type}
            className={`
                submit-button
                ${fullWidth ? 'full-width' : ''}
                ${isLoading ? 'loading' : ''}
                ${isDisabled ? 'disabled' : ''}
                ${className}
            `}
            disabled={isDisabled}
            onClick={handleClick}
            aria-disabled={isDisabled}
            {...props}
        >
            <span className="button-content">
                {isLoading ? (
                    <>
                        <Loader2 className="loader-icon" size={18}/>
                        <span>{loadingText}</span>
                    </>
                ) : (
                    <>
                        {groupIcon}
                        <span>{children}</span>
                    </>
                )}
            </span>
        </button>
    );
};

export default CustomButton;