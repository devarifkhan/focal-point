import { getState } from "../states/states";
import STORAGE_KEYS from "../storage/STORAGE_KEYS";
import {  tabTimes, urlTimes, urlAccumulatedTimes, notificationStates, urlStateTransitions } from "../states/states";
async function loadInitialState() {
    tabTimes = await getState(STORAGE_KEYS.TAB_TIMES, {});
    urlTimes = await getState(STORAGE_KEYS.URL_TIMES, {});
    urlAccumulatedTimes = await getState(STORAGE_KEYS.URL_ACCUMULATED_TIMES, {});
    notificationStates = await getState(STORAGE_KEYS.NOTIFICATION_STATES, {});

    // Convert object to Map for state transitions
    const stateTransitions = await getState(STORAGE_KEYS.URL_STATE_TRANSITIONS, {});
    urlStateTransitions = new Map(Object.entries(stateTransitions));
    console.log("Initial state loaded:", tabTimes, urlTimes, urlAccumulatedTimes, notificationStates, urlStateTransitions);
}



export { loadInitialState };