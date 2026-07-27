async function getState(key, defaultValue = {}) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] || defaultValue);
      });
      console.log("State retrieved:", key, defaultValue);
    });
  }
  
  async function setState(key, value) {
    return new Promise((resolve) => {
      const data = {};
      data[key] = value;
      chrome.storage.local.set(data, resolve);
      console.log("State set:", key, value);
    });
  }

  export { getState, setState };

  let activeTabId = null;
let activeTabStartTime = null;
let tabTimes = {};
let urlTimes = {};
let urlAccumulatedTimes = {};
let notificationStates = {};
let urlStateTransitions = new Map();
let isPaused = false;
let lastActiveTime = null;
let accumulatedTime = {};

async function getAccessToken() {
  return new Promise((resolve, reject) => {
      chrome.storage.local.get("access_token", (result) => {
          if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
          } else {
              resolve(result.access_token);
          }
      });
  });
}

export { activeTabId, activeTabStartTime, tabTimes, urlTimes, urlAccumulatedTimes, notificationStates, urlStateTransitions, isPaused, lastActiveTime, accumulatedTime,getAccessToken };