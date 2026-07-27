import React, { useState, useEffect } from 'react';
import CustomButton from '../../components/common/CustomButton/CustomButton';
import { Clock, RotateCcw } from 'lucide-react';

const ResetConfiguration = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [resetConfig, setResetConfig] = useState({
        enabled: false,
        frequency: 'daily',
        dayOfWeek: 1, // Monday
        dayOfMonth: 1,
        lastResetTime: 0
    });
    const [message, setMessage] = useState({ type: '', message: '' });

    // Load the current configuration on component mount
    useEffect(() => {
        loadResetConfig();
    }, []);

    const loadResetConfig = async () => {
        try {
            const result = await new Promise(resolve => {
                chrome.storage.local.get('resetConfig', resolve);
            });
            
            if (result.resetConfig) {
                setResetConfig(result.resetConfig);
            }
        } catch (error) {
            console.error("Error loading reset configuration:", error);
        }
    };

    const handleConfigChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        setResetConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
            // When changing frequency, set appropriate defaults
            ...(name === 'frequency' && value === 'weekly' ? { dayOfWeek: 1 } : {}),
            ...(name === 'frequency' && value === 'monthly' ? { dayOfMonth: 1 } : {})
        }));
    };

    const saveConfiguration = async () => {
        setIsLoading(true);
        try {
            // Send message to background script to update configuration
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { 
                        type: 'updateResetConfig', 
                        config: resetConfig 
                    },
                    response => {
                        if (response.success) {
                            resolve(response);
                        } else {
                            reject(new Error(response.error || 'Failed to save configuration'));
                        }
                    }
                );
            });
            
            setMessage({ type: 'success', message: 'Reset configuration saved successfully' });
            setTimeout(() => setMessage({ type: '', message: '' }), 3000);
        } catch (error) {
            console.error("Error saving reset configuration:", error);
            setMessage({ type: 'error', message: error.message || 'Failed to save configuration' });
        } finally {
            setIsLoading(false);
        }
    };

    const performManualReset = async () => {
        if (!window.confirm("This will reset all timer data for all websites. This action cannot be undone. Continue?")) {
            return;
        }
        
        setIsLoading(true);
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { type: 'manualResetAll' },
                    response => {
                        if (response.success) {
                            resolve(response);
                        } else {
                            reject(new Error(response.error || 'Failed to perform reset'));
                        }
                    }
                );
            });
            
            setMessage({ 
                type: 'success', 
                message: `Successfully reset ${response.resetCount} websites` 
            });
            setTimeout(() => setMessage({ type: '', message: '' }), 3000);
        } catch (error) {
            console.error("Error performing manual reset:", error);
            setMessage({ type: 'error', message: error.message || 'Failed to perform reset' });
        } finally {
            setIsLoading(false);
        }
    };

    // Function to format the last reset time
    const formatLastResetTime = () => {
        if (!resetConfig.lastResetTime) {
            return 'Never';
        }
        
        const date = new Date(resetConfig.lastResetTime);
        return date.toLocaleString();
    };

    return (
        <div className="reset-configuration-card">
            <div className="reset-config-header">
                <h3>Auto Reset Configuration</h3>
                <p className="reset-config-description">
                    Configure automatic reset of time tracking data for all websites. This only affects local data and won't impact your cloud-stored data.
                </p>
            </div>
            
            <div className="reset-config-form">
                <div className="form-group">
                    <label className="toggle-label">
                        <input
                            type="checkbox"
                            name="enabled"
                            checked={resetConfig.enabled}
                            onChange={handleConfigChange}
                        />
                        Enable automatic reset
                    </label>
                </div>
                
                {resetConfig.enabled && (
                    <>
                        <div className="form-group">
                            <label>Reset Frequency</label>
                            <select 
                                name="frequency" 
                                value={resetConfig.frequency}
                                onChange={handleConfigChange}
                                className="form-input"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        
                        {resetConfig.frequency === 'weekly' && (
                            <div className="form-group">
                                <label>Day of Week</label>
                                <select 
                                    name="dayOfWeek" 
                                    value={resetConfig.dayOfWeek}
                                    onChange={handleConfigChange}
                                    className="form-input"
                                >
                                    <option value={0}>Sunday</option>
                                    <option value={1}>Monday</option>
                                    <option value={2}>Tuesday</option>
                                    <option value={3}>Wednesday</option>
                                    <option value={4}>Thursday</option>
                                    <option value={5}>Friday</option>
                                    <option value={6}>Saturday</option>
                                </select>
                            </div>
                        )}
                        
                        {resetConfig.frequency === 'monthly' && (
                            <div className="form-group">
                                <label>Day of Month</label>
                                <select 
                                    name="dayOfMonth" 
                                    value={resetConfig.dayOfMonth}
                                    onChange={handleConfigChange}
                                    className="form-input"
                                >
                                    {[...Array(31)].map((_, i) => (
                                        <option key={i+1} value={i+1}>{i+1}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        <div className="form-group">
                            <label>Last Reset: {formatLastResetTime()}</label>
                        </div>
                    </>
                )}
                
                <div className="form-actions">
                    <CustomButton
                        disabled={isLoading}
                        isLoading={isLoading}
                        onClick={saveConfiguration}
                        groupIcon={<Clock className="input-icon" size={15} />}
                        className="save-config-button"
                    >
                        Save Configuration
                    </CustomButton>
                    
                    <CustomButton
                        disabled={isLoading}
                        isLoading={isLoading}
                        onClick={performManualReset}
                        groupIcon={<RotateCcw className="input-icon" size={15} />}
                        className="manual-reset-button danger-button"
                    >
                        Reset All Now
                    </CustomButton>
                </div>
                
                {message.message && (
                    <div className={`form-message ${message.type}`}>
                        {message.message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResetConfiguration;