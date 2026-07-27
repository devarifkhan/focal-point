import { X } from 'lucide-react';
import React, { useEffect } from 'react';
import CustomButton from "../CustomButton/CustomButton";
import "./CustomModal.css";

const CustomModal = ({
                   isOpen,
                   onClose,
                   title,
                   children,
                   showFooter = true,
                   primaryButtonText = 'Save',
                   secondaryButtonText = 'Close',
                   handleAction,
                   isLoading,
                   submitBtnFullWidth = false
               }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-wrapper">
                <div className="modal-backdrop" onClick={onClose}></div>
                <div className="modal-scroll-container">
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3 className="modal-title">{title}</h3>
                                <button onClick={onClose} className="modal-close">
                                    <X className="modal-close-icon"/>
                                </button>
                            </div>

                            <div className="modal-body">
                                {children}
                            </div>

                            {showFooter && (
                                <div className="modal-footer">
                                    <button onClick={onClose} className="btn btn-secondary w-100px">
                                        {secondaryButtonText}
                                    </button>
                                    <CustomButton
                                        disabled={isLoading}
                                        isLoading={isLoading}
                                        fullWidth={submitBtnFullWidth}
                                        loadingText={primaryButtonText}
                                        type="submit"
                                        onClick={handleAction}
                                        className="w-100px"
                                    >
                                        {primaryButtonText}
                                    </CustomButton>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CustomModal;