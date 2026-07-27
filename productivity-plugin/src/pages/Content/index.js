const IMAGE_BASE_URL = 'https://focusly-api.shadhin.ai/media/';

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    // Handle PING message for content script detection
    if (message.type === 'PING') {
        sendResponse({ status: 'alive' });
        return true;
    }

    if (message.message) {
        // Get the redirect URL, message, and image from the message object
        const redirectUrl = message.redirectUrl || '';
        const customMessage = message.customMessage || '';
        const image = message.image || '';
        
        console.log("Received block message:", message);

        // Format the redirect URL if it exists
        const formattedRedirectUrl = redirectUrl ?
            (redirectUrl.startsWith('http') ? redirectUrl : `https://${redirectUrl}`) : '';

        // Format the image URL if it exists
        const backgroundImage = image ?
            `${IMAGE_BASE_URL}${image}` : '';

        // Create the HTML with conditional sections for redirect, message, and background image
        document.body.innerHTML = `
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
            <div style="
                min-height: 100vh; 
                width: 100%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                background-color: #232428;
                ${backgroundImage ? `background-image: url('${backgroundImage}');` : ''}
                ${backgroundImage ? 'background-size: cover;' : ''}
                ${backgroundImage ? 'background-position: center;' : ''}
                ${backgroundImage ? 'background-repeat: no-repeat;' : ''}
                position: relative;
            ">
                <!-- Overlay for better text readability when background image is present -->
                ${backgroundImage ? `<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(35, 36, 40, 0.75);"></div>` : ''}
                
                <div style="
                    text-align: center; 
                    padding: 2.5rem; 
                    max-width: 600px; 
                    background-color: ${backgroundImage ? 'rgba(35, 36, 40, 0.5)' : 'transparent'};
                    border-radius: 15px;
                    backdrop-filter: ${backgroundImage ? 'blur(8px)' : 'none'};
                    box-shadow: ${backgroundImage ? '0 10px 25px rgba(0, 0, 0, 0.2)' : 'none'};
                    position: relative;
                    z-index: 1;
                ">
                    <div style="display: flex; justify-content: center; margin-bottom: 20px;">
                        <img 
                            src="${chrome.runtime.getURL('logo-full.svg')}"
                            style="width: 200px; height: auto; max-height: 200px;"
                            alt="Access Restricted Icon"
                        />
                    </div>
                    <h1 style="font-size: 36px; font-weight: 700; color: #ea484f; margin-bottom: 2rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; gap: 12px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        Access Restricted
                    </h1>
                    <p style="color: white; font-size: 16px; margin-bottom: 20px; line-height: 1.6;">
                        This site has been blocked by <a href="https://focusly.pro" target="_blank" style="color: #ea484f; text-decoration: none; font-weight: 600; transition: all 0.3s ease;">Focusly.pro</a> to help you stay focused.
                    </p>
                    <p style="color: white; font-size: 16px; margin-bottom: 30px; line-height: 1.6; opacity: 0.9; white-space: nowrap;">
                        If you need access, please adjust your plugin in the <a href="#" id="openSettingsLink" style="color: #ea484f; text-decoration: none; font-weight: 600; transition: all 0.3s ease;">settings</a> page.
                    </p>
                    
                    ${customMessage ? `
                    <div style="background-color: rgba(42, 44, 49, 0.8); border-radius: 10px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #ea484f;">
                        <p style="color: white; font-size: 16px; margin: 0; line-height: 1.5;">
                            "${customMessage}"
                        </p>
                    </div>
                    ` : ''}
                    ${formattedRedirectUrl ? `
                    <div style="margin-top: 25px; margin-bottom: 25px;">
                        <a href="${formattedRedirectUrl}" target="_blank" style="display: inline-block; background-color: #ea484f; color: white; font-size: 18px; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none; transition: all 0.3s ease; box-shadow: 0 4px 10px rgba(234, 72, 79, 0.3);">
                            Go to Recommended Site
                        </a>
                    </div>
                    ` : ''}
                   
                </div>
            </div>
        </body>
        `;

        // Add event listener for the settings link
        document.getElementById('openSettingsLink')?.addEventListener('click', function (e) {
            e.preventDefault();
            // Send message to background script to open options page
            chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
        });

        // Automatically reload options page after 3 seconds
        setTimeout(() => {
            console.log('Sending reload message to options page');
            chrome.runtime.sendMessage({ type: 'RELOAD_OPTIONS_PAGE' }).catch(err => {
                console.log('Error sending reload message:', err);
            });
        }, 3000);

        // Send response to confirm block page was shown
        sendResponse({ status: 'blocked' });
    }

    return true;
});