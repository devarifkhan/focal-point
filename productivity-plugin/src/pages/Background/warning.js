// Function to get query parameters from the URL
function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    
    // Safely parse numeric values with fallbacks
    const parseNumeric = (value) => {
        if (value === null || value === undefined || value === '') return 0;
        
        // First try to decode the value
        let decodedValue;
        try {
            decodedValue = decodeURIComponent(value);
        } catch (e) {
            console.error('Error decoding value:', value, e);
            decodedValue = value;
        }
        
        // Handle both numeric strings and direct numbers
        const parsedValue = parseFloat(decodedValue);
        return isNaN(parsedValue) ? 0 : parsedValue;
    };
    
    // Get values with safety checks
    const timeSpentRaw = params.get('timeSpent');
    const totalTimeRaw = params.get('totalTime');
    const percentageRaw = params.get('percentage');
    const timeSpent = parseNumeric(timeSpentRaw);
    const totalTime = parseNumeric(totalTimeRaw);
    const percentage = parseNumeric(percentageRaw);
    
    // Debug logging
    console.log('Raw timeSpent:', timeSpentRaw, 'type:', typeof timeSpentRaw);
    console.log('Raw totalTime:', totalTimeRaw, 'type:', typeof totalTimeRaw);
    console.log('Raw percentage:', percentageRaw, 'type:', typeof percentageRaw);
    console.log('Parsed timeSpent:', timeSpent, 'type:', typeof timeSpent);
    console.log('Parsed totalTime:', totalTime, 'type:', typeof totalTime);
    console.log('Parsed percentage:', percentage, 'type:', typeof percentage);
    
    // Safely decode other parameters
    const safelyDecode = (value) => {
        if (!value) return null;
        try {
            return decodeURIComponent(value);
        } catch (e) {
            console.error('Error decoding value:', value, e);
            return value;
        }
    };
    
    // Get title (URLSearchParams already handles decoding)
    const title = params.get('title');
    
    return {
        timeSpent: timeSpent,
        blockSiteUrl: safelyDecode(params.get('blockSiteUrl')),
        totalTime: totalTime,
        calendarUrl: safelyDecode(params.get('calendarUrl')),
        message: safelyDecode(params.get('message')),
        redirectUrl: safelyDecode(params.get('redirectUrl')),
        imageUrl: safelyDecode(params.get('image')),
        title: title,
        originalTabUrl: safelyDecode(params.get('originalTabUrl')),
        percentage: percentage
    };
}

// Function to resume time tracking
async function resumeTimeTracking() {
    try {
        // Send a message to the background script to resume time tracking
        await chrome.runtime.sendMessage({
            type: "RESUME_TIME_TRACKING",
            reason: "warning_page_closed"
        });
        console.log("Sent message to resume time tracking");
        
        // We need to make sure the message is sent before the page is closed
        // Add a small delay to ensure the message is processed
        await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
        console.error("Error resuming time tracking:", error);
    }
}

// Function to handle returning to original site
async function handleReturnToOriginalSite(originalTabUrl) {
    try {
        // Resume time tracking before navigating back
        await resumeTimeTracking();
        
        // Query for all tabs
        const tabs = await chrome.tabs.query({});
        
        // Normalize the URL for comparison to handle possible variations
        const normalizeUrl = (url) => {
            try {
                // Create a URL object to handle different formats
                const urlObj = new URL(url);
                return urlObj.origin + urlObj.pathname;
            } catch (e) {
                console.error('Error normalizing URL:', e);
                return url;
            }
        };

        const normalizedOriginalUrl = normalizeUrl(originalTabUrl);
        
        // Find the original tab using a more flexible matching approach
        const existingTab = tabs.find(tab => {
            // First try exact match
            if (tab.url === originalTabUrl) return true;
            
            // If not exact match, try normalized comparison to handle parameters
            return normalizeUrl(tab.url) === normalizedOriginalUrl;
        });
        
        if (existingTab) {
            console.log("Found existing tab with ID:", existingTab.id);
            // If tab exists, switch to it
            await chrome.tabs.update(existingTab.id, { active: true });
            
            // Get the current tab to close it
            const currentTab = await new Promise(resolve => chrome.tabs.getCurrent(resolve));
            if (currentTab) {
                await chrome.tabs.remove(currentTab.id);
                console.log("Closed warning page tab:", currentTab.id);
            }
        } else {
            console.log("Original tab not found, creating new tab");
            // If tab doesn't exist, create new one
            await chrome.tabs.create({ url: originalTabUrl });
            
            // Get the current tab to close it
            const currentTab = await new Promise(resolve => chrome.tabs.getCurrent(resolve));
            if (currentTab) {
                await chrome.tabs.remove(currentTab.id);
                console.log("Closed warning page tab:", currentTab.id);
            }
        }
    } catch (error) {
        console.error('Error handling return to original site:', error);
        // Fallback to simple navigation if something goes wrong
        // First try to resume time tracking
        await resumeTimeTracking();
        window.location.href = originalTabUrl;
    }
}

// Expose the function to window object
window.handleReturnToOriginalSite = handleReturnToOriginalSite;

function setCalendarIframe(calendarUrl) {
    try {
        const calendarShowDiv = document.querySelector('.calendar-show');
        if (!calendarUrl || calendarUrl === 'null' || calendarUrl === 'undefined') {
            calendarShowDiv.style.display = 'none';
            return;
        }

        const iframe = document.createElement('iframe');

        // Enhanced iframe styling
        iframe.src = calendarUrl;
        iframe.style.border = '0';
        iframe.style.width = '800px'; // Increased width
        iframe.style.height = '600px'; // Increased height
        iframe.style.maxWidth = '100%'; // Responsive
        iframe.style.maxHeight = '80vh'; // Responsive using viewport height
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('scrolling', 'no');

        const container = document.getElementById('calendar-container');

        // Enhanced container styling
        container.style.width = '100%';
        container.style.height = 'auto';
        container.style.minHeight = '600px';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.padding = '20px';

        container.innerHTML = '';
        container.appendChild(iframe);
        calendarShowDiv.style.display = 'block';
    } catch (error) {
        console.error('Error setting calendar iframe:', error);
    }
}

// Usage example:
document.addEventListener('DOMContentLoaded', async () => {
    // Get calendar URL from storage
    chrome.storage.local.get(['calendarUrl'], (result) => {
        if (result.calendarUrl) {
            setCalendarIframe(result.calendarUrl);
        }
    });
});

// Update the content with the time spent and total time
document.addEventListener("DOMContentLoaded", () => {
    try {
        console.log("Raw URL parameters:", window.location.search);
        
        const params = getQueryParams();
        console.log("Parsed parameters:", params);
        
        const {timeSpent, totalTime, calendarUrl, message, redirectUrl, imageUrl, title, blockSiteUrl, originalTabUrl, percentage} = params;

        // Show all available information regardless of time values
        if(title){
            // Set document title safely, handling special characters
            document.title = title;
            console.log("Set document title to:", title);
        } else {
            console.log("No title parameter provided");
        }

        if (imageUrl) {
            const image = 'https://focusly-api.shadhin.ai/media/' + imageUrl;
            document.body.style.backgroundImage = `url(${image})`;
            console.log("Set background image to:", image);
        } else {
            // Ensure the gradient background from CSS is used when no image is provided
            document.body.style.backgroundImage = 'none';
            document.body.style.background = 'linear-gradient(to bottom right, #232428, #3a3f43)';
            console.log("Using default gradient background");
        }

        const timeInfoElement = document.getElementById("time-info");
        const timeInfos = document.getElementById("time-infos");
        const redirectMessageElement = document.getElementById("redirect-message");
        const blockSiteUrlElement = document.getElementById("block-site-url");

        // Remove the color styling based on percentage parameter - keep default styling

        if (!message) {
            redirectMessageElement.style.display = 'none';
            console.log("No message provided, hiding message element");
        } else {
            console.log("Displaying message:", message);
        }

        let formattedRedirectUrl = redirectUrl;
        if (redirectUrl && !redirectUrl.startsWith("http://") && !redirectUrl.startsWith("https://")) {
            if (!redirectUrl.startsWith("www.")) {
                formattedRedirectUrl = "http://www." + redirectUrl;
            } else {
                formattedRedirectUrl = "http://" + redirectUrl;
            }
            console.log("Formatted redirect URL:", formattedRedirectUrl);
        }

        console.log("Time values check:", {
            timeSpent: timeSpent,
            totalTime: totalTime,
            isNaN_timeSpent: isNaN(timeSpent),
            isNaN_totalTime: isNaN(totalTime),
            typeof_timeSpent: typeof timeSpent,
            typeof_totalTime: typeof totalTime
        });

        // More lenient check - consider zero values as valid
        const hasValidTimeData = (timeSpent !== undefined && totalTime !== undefined && 
                                  !isNaN(timeSpent) && !isNaN(totalTime));
        
        if (hasValidTimeData) {
            console.log("Time data is valid:", timeSpent, totalTime);
            // Calculate percentage only if totalTime is not zero to avoid division by zero
            let remainingPercentage = 0;
            if (totalTime > 0) {
                remainingPercentage = ((1 - timeSpent / totalTime) * 100).toFixed(0);
                console.log("Calculated remaining percentage:", remainingPercentage);
            } else {
                console.log("Total time is zero, can't calculate percentage");
            }
            
            // Set content safely, preserving the full title including special characters
            if (title) {
                // Use innerHTML if the title contains HTML that should be rendered
                // Otherwise use textContent for safer text rendering
                if (title.includes('<') && title.includes('>')) {
                    timeInfoElement.innerHTML = title;
                    console.log("Set time info element HTML to:", title);
                } else {
                    timeInfoElement.textContent = title;
                    console.log("Set time info element text to:", title);
                }
            }
            
            // Create HTML for the buttons
            let buttonsHtml = '';
            
            // Add button to go back to original tab if available
            if (originalTabUrl) {
                buttonsHtml += `<button class="action-button return-button" style="margin-right: 10px;" data-url="${originalTabUrl}">Return to Original Site</button>`;
                console.log("Added return button for URL:", originalTabUrl);
            }
            
            // Add button for redirect URL if available
            if (formattedRedirectUrl) {
                buttonsHtml += `<button class="action-button redirect-button" data-url="${formattedRedirectUrl}">Visit Redirect URL</button>`;
                console.log("Added redirect button for URL:", formattedRedirectUrl);
            }
            
            timeInfos.innerHTML = buttonsHtml;
            console.log("Set buttons HTML:", buttonsHtml);

            // Add event listeners after adding buttons to DOM
            if (originalTabUrl) {
                const returnButton = timeInfos.querySelector('.return-button');
                if (returnButton) {
                    returnButton.addEventListener('click', () => handleReturnToOriginalSite(originalTabUrl));
                    console.log("Added event listener to return button");
                } else {
                    console.warn("Return button not found in DOM after adding HTML");
                }
            }

            if (formattedRedirectUrl) {
                const redirectButton = timeInfos.querySelector('.redirect-button');
                if (redirectButton) {
                    redirectButton.addEventListener('click', async () => {
                        // First resume time tracking 
                        await resumeTimeTracking();
                        // Then create the redirect tab
                        chrome.tabs.create({ url: formattedRedirectUrl });
                    });
                    console.log("Added event listener to redirect button");
                } else {
                    console.warn("Redirect button not found in DOM after adding HTML");
                }
            }
            
            if (message) {
                redirectMessageElement.textContent = message;
                console.log("Set redirect message to:", message);
            }
            
            if (blockSiteUrl) {
                blockSiteUrlElement.innerHTML = `<a href="${blockSiteUrl}" target="_blank">${blockSiteUrl}</a>`;
                console.log("Set block site URL to:", blockSiteUrl);
            }
            
            setCalendarIframe(calendarUrl);
        } else {
            console.warn("Time data is not valid:", { 
                timeSpent: timeSpent, 
                totalTime: totalTime, 
                rawTimeSpent: params.get ? params.get('timeSpent') : null,
                rawTotalTime: params.get ? params.get('totalTime') : null
            });
            
            // Still display all available information even if time data is invalid
            if (title) {
                // Use innerHTML if the title contains HTML that should be rendered
                // Otherwise use textContent for safer text rendering
                if (title.includes('<') && title.includes('>')) {
                    timeInfoElement.innerHTML = title;
                    console.log("Set time info element HTML to:", title);
                } else {
                    timeInfoElement.textContent = title;
                    console.log("Set time info element text to:", title);
                }
            } else {
                timeInfoElement.textContent = "Time Limit Alert";
            }
            
            // Create HTML for the buttons even if time data is invalid
            let buttonsHtml = '';
            
            if (originalTabUrl) {
                buttonsHtml += `<button class="action-button return-button" style="margin-right: 10px;" data-url="${originalTabUrl}">Return to Original Site</button>`;
            }
            
            if (formattedRedirectUrl) {
                buttonsHtml += `<button class="action-button redirect-button" data-url="${formattedRedirectUrl}">Visit Redirect URL</button>`;
            }
            
            if (buttonsHtml) {
                timeInfos.innerHTML = buttonsHtml;
                
                // Add event listeners
                if (originalTabUrl) {
                    const returnButton = timeInfos.querySelector('.return-button');
                    if (returnButton) {
                        returnButton.addEventListener('click', () => handleReturnToOriginalSite(originalTabUrl));
                    }
                }
                
                if (formattedRedirectUrl) {
                    const redirectButton = timeInfos.querySelector('.redirect-button');
                    if (redirectButton) {
                        redirectButton.addEventListener('click', async () => {
                            // First resume time tracking 
                            await resumeTimeTracking();
                            // Then create the redirect tab
                            chrome.tabs.create({ url: formattedRedirectUrl });
                        });
                    }
                }
            }
            
            if (message) {
                redirectMessageElement.textContent = message;
            }
            
            if (blockSiteUrl) {
                blockSiteUrlElement.innerHTML = `<a href="${blockSiteUrl}" target="_blank">${blockSiteUrl}</a>`;
            }
            
            setCalendarIframe(calendarUrl);
        }
    } catch (error) {
        console.error("Error processing warning page:", error);
        document.getElementById("time-info").textContent = "Error processing warning page data. Please check console for details.";
    }

    // Add beforeunload event listener to resume time tracking when tab is closed
    window.addEventListener('beforeunload', async () => {
        console.log("Warning page is closing, attempting to resume time tracking");
        await resumeTimeTracking();
    });
});

// Add CSS for the new buttons
document.addEventListener('DOMContentLoaded', () => {
    // Create a style element
    const style = document.createElement('style');
    
    // Add CSS for the buttons
    style.textContent = `
        .action-button {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            border-radius: 5px;
            text-decoration: none;
            transition: all 0.2s ease;
            cursor: pointer;
            font-size: 14px !important;
            margin-bottom: 10px;
            border:1px solid black;
        }
        
        .return-button {
            background: transparent;
            
        }
        
        .return-button:hover {
            background-color: transparent;
            transform: scale(1.05);
        }
        
        /* Override any parent container backgrounds */
        #time-infos {
            background-color: transparent !important;
            border: none !important;
            padding: 0 !important;
        }
    `;
    
    // Append the style element to the head
    document.head.appendChild(style);
});