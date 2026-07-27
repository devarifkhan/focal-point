// Notification helper for creating and managing Chrome's native notifications
import { getTimeTrackerController } from './timeTracker';

// Storage for tracking notification IDs
const notificationIds = new Map();

// Collection of productivity tips to show in notifications
const productivityTips = [
  "💡 Tip: Try the Pomodoro Technique - 25 minutes of focus followed by a 5-minute break.",
  "💡 Tip: Prioritize tasks with the Eisenhower Matrix - urgent vs. important.",
  "💡 Tip: Use the 2-minute rule - if it takes less than 2 minutes, do it now.",
  "💡 Tip: Set specific goals before starting your work session.",
  "💡 Tip: Remove distractions from your environment before starting work.",
  "💡 Tip: Take short breaks to maintain high productivity levels.",
  "💡 Tip: Stay hydrated - drink water to maintain cognitive function.",
  "💡 Tip: Use the 20-20-20 rule for eye strain - every 20 minutes, look at something 20 feet away for 20 seconds.",
  "💡 Tip: Schedule complex tasks during your energy peak times.",
  "💡 Tip: Track your progress to stay motivated.",
];

// Get a random tip from the collection
function getRandomTip() {
  const randomIndex = Math.floor(Math.random() * productivityTips.length);
  return productivityTips[randomIndex];
}

// Create a colorful notification with Chrome's API
export async function showChromeNotification(options) {
  const {
    id = `notification-${Date.now()}`,
    title,
    message,
    contextMessage,
    iconUrl,
    buttons = [],
    onButtonClick,
    requireInteraction = true, // Keep the notification visible until the user interacts with it
    silent = false,
    priority = 2, // Use high priority (2) to increase visibility
    includeProductivityTip = false
  } = options;

  // Store the callback if provided
  if (onButtonClick) {
    notificationIds.set(id, {
      callback: onButtonClick
    });
  }

  // Use the colorful icon for notifications - this is the red Focusly logo
  const notificationIcon = iconUrl || chrome.runtime.getURL("icon-128.png");

  // Format the message with emojis for more colorful appearance
  let formattedMessage = message.replace(/(\d+)%/g, '🔔 $1%')
                                .replace(/minutes/g, 'mins ⏱️')
                                .replace(/critical tasks/g, '⭐ critical tasks ⭐');
  
  // Add a productivity tip if requested
  if (includeProductivityTip) {
    formattedMessage = `${formattedMessage}\n\n${getRandomTip()}`;
  }

  return new Promise((resolve) => {
    chrome.notifications.create(
      id,
      {
        type: "basic",
        title: title || "Focusly",
        message: "\n" + formattedMessage || "",
        contextMessage: contextMessage ? `\n✨ ${contextMessage} ✨` : "",
        iconUrl: notificationIcon,
        buttons: buttons.slice(0, 2).map((button, index) => {
          // Add emoji to buttons for more color
          const buttonEmoji = index === 0 ? '✓ ' : '↗️ ';
          return { title: `${buttonEmoji}${button}` };
        }),
        requireInteraction,
        silent,
        priority
      },
      (notificationId) => {
        resolve(notificationId);
      }
    );
  });
}

// Handle notification clicks
export function setupNotificationListeners() {
  // Listen for notification clicks
  chrome.notifications.onClicked.addListener((notificationId) => {
    console.log(`Notification ${notificationId} clicked`);
    
    // Resume time tracking when notification is clicked directly
    if (notificationId.includes('time-notification')) {
      const timeTracker = getTimeTrackerController();
      if (timeTracker && timeTracker.isPaused() && timeTracker.getPauseReason().includes('notification')) {
        timeTracker.setPaused(false);
        timeTracker.resetCheckTime();
        console.log("Time tracking resumed after notification clicked");
      }
    }
    
    // Clear the notification
    chrome.notifications.clear(notificationId);
  });

  // Listen for notification button clicks
  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    console.log(`Notification ${notificationId} button ${buttonIndex} clicked`);
    
    // Get the info for this notification
    const notificationInfo = notificationIds.get(notificationId);
    if (notificationInfo && notificationInfo.callback) {
      notificationInfo.callback(buttonIndex);
      // Remove the callback after it's been called
      notificationIds.delete(notificationId);
    }
    
    // Clear the notification
    chrome.notifications.clear(notificationId);
  });

  // Listen for notification closed
  chrome.notifications.onClosed.addListener((notificationId) => {
    console.log(`Notification ${notificationId} closed`);
    
    // Resume time tracking when a time notification is closed
    if (notificationId.includes('time-notification')) {
      const timeTracker = getTimeTrackerController();
      if (timeTracker && timeTracker.isPaused() && timeTracker.getPauseReason().includes('notification')) {
        timeTracker.setPaused(false);
        timeTracker.resetCheckTime();
        console.log("Time tracking resumed after notification closed");
      }
    }
    
    // Clean up any stored callbacks
    notificationIds.delete(notificationId);
  });
  
  // Add a listener for the settings button in Chrome notifications if available
  if (chrome.notifications.onSettingsButtonClicked) {
    chrome.notifications.onSettingsButtonClicked.addListener((notificationId) => {
      console.log(`Settings button clicked for notification ${notificationId}`);
      
      // Resume time tracking
      if (notificationId.includes('time-notification')) {
        const timeTracker = getTimeTrackerController();
        if (timeTracker && timeTracker.isPaused()) {
          timeTracker.setPaused(false);
          timeTracker.resetCheckTime();
        }
      }
      
      // Open options page
      chrome.runtime.openOptionsPage();
      
      // Clear the notification
      chrome.notifications.clear(notificationId);
    });
  }
}

// Time utilization messages based on percentage used
function getTimeUtilizationMessage(percentage, timeSpentMinutes, totalTimeMinutes, domain) {
  // Calculate remaining time in minutes
  const remainingMinutes = totalTimeMinutes - timeSpentMinutes;
  
  if (percentage >= 75) {
    return {
      title: `🔴 Critical: ${percentage}% of time used on ${domain}`,
      // message: `⚠️ Only ${remainingMinutes} mins left out of your ${totalTimeMinutes}-min allocation!\n\nComplete your most critical tasks quickly before time runs out.`,
      testMode: "This is a final reminder - time is almost up! Focus on completing your most essential tasks now."
    };
  } else if (percentage >= 50) {
    return {
      title: `🟡 Warning: ${percentage}% of time used on ${domain}`,
      // message: `You've used ${timeSpentMinutes} of ${totalTimeMinutes} mins on this site.\n\nYou have ${remainingMinutes} mins remaining. Plan your tasks wisely!`,
      testMode: "This is a mid-point reminder to help you stay on track. You're halfway through your allocated time."
    };
  } else {
    return {
      title: `🟢 Notice: ${percentage}% of time used on ${domain}`,
      // message: `You've used ${timeSpentMinutes} of ${totalTimeMinutes} mins on this site.\n\nStill ${remainingMinutes} mins remaining. You're doing great!`,
      testMode: "This is an early notification to help you track your time usage."
    };
  }
}

// Create a notification about time usage with colorful formatting
export async function showTimeNotification(options) {
  const {
    percentage,
    timeSpentMinutes,
    totalTimeMinutes,
    urlDomain,
    customMessage,
    onContinueClick,
    onRedirectClick,
    redirectUrl,
    isTestMode = false
  } = options;

  const domain = urlDomain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  
  // Create buttons - always include "Continue browsing" and a second button
  let buttons = ["Continue browsing"];
  if (redirectUrl) {
    // If we have a redirect URL, use it as the second button
    const redirectDomain = redirectUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    buttons.push(`Switch to ${redirectDomain}`);
  } else {
    // If no redirect URL, use Options as the second button (renamed from Settings)
    buttons.push("Options");
  }

  // Get appropriate messages based on percentage
  const timeMessages = getTimeUtilizationMessage(percentage, timeSpentMinutes, totalTimeMinutes, domain);
  
  // Pause time tracking while showing notification
  const timeTracker = getTimeTrackerController();
  if (timeTracker) {
    timeTracker.setPaused(true, "notification");
  }

  // Create title with warning icon and percentage
  const warningTitle = `${percentage >= 75 
  ? '⚠️ Heads up! ' 
  : percentage >= 50 
    ? '⚠️ Just a reminder: ' 
    : 'All good! '}You've used ${percentage}% of your available time.`;
  
  // Create pause message line
  const pauseMessage = "⏸️ Time paused - Click continue to resume";
  
  // Prepare main message content - either test message, custom message or default
  let mainMessage = "";
  if (isTestMode) {
    mainMessage = timeMessages.testMode;
  } else if (customMessage) {
    mainMessage = customMessage;
  } else {
    mainMessage = "";
  }
  let fullMessage="";
  // Format the message using emoji prefixes for each line instead of separator lines
  if(!customMessage){
    fullMessage = `${pauseMessage}`;
  }else{
  fullMessage = `${pauseMessage}                                     \n\n📊 ${mainMessage}`;
  }
  // Set up notification options with colorful formatting
  const notificationOptions = {
    id: `time-notification-${domain}-${Date.now()}`,
    title: isTestMode ? `TEST: ${timeMessages.title}` : warningTitle,
    message: fullMessage,
    contextMessage: '',
    buttons,
    requireInteraction: true,
    silent: false,
    priority: 2,
    includeProductivityTip: false,
    onButtonClick: (buttonIndex) => {
      // Always resume time tracking regardless of which button is clicked
      if (timeTracker && timeTracker.isPaused()) {
        timeTracker.setPaused(false);
        timeTracker.resetCheckTime();
      }
      
      if (buttonIndex === 0) {
        // Continue browsing button
        if (onContinueClick) {
          onContinueClick();
        }
      } else if (buttonIndex === 1) {
        // Second button - either redirect or options
        if (redirectUrl && onRedirectClick) {
          // This is a redirect button
          onRedirectClick();
        } else {
          // This is an options button
          chrome.runtime.openOptionsPage();
          console.log("Opening options page from Options button");
        }
      }
    }
  };

  // Show the notification
  return showChromeNotification(notificationOptions);
}