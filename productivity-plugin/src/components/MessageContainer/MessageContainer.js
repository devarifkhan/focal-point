import React, {Fragment, useEffect} from 'react';
import {CheckCircle2, XCircle} from "lucide-react";

const MessageContainer = ({message}) => {
    // Debug log to see when messages are received
    useEffect(() => {
        if (message?.message) {
            console.log("MessageContainer received:", message);
        }
    }, [message]);

    return (
        <Fragment>
            {message?.message && (
                <div 
                    className={`form-message ${message?.type} ${message?.onClick ? 'clickable' : ''}`}
                    onClick={message?.onClick}
                    style={message?.onClick ? {cursor: 'pointer'} : {}}
                >
                    {message?.type === 'success' ? (
                        <CheckCircle2 size={15}/>
                    ) : (
                        <XCircle size={15}/>
                    )}
                    {message?.message}
                </div>
            )}
        </Fragment>
    );
};

export default MessageContainer;