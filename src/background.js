/**
 * Comparison functions
 */
function compareByUrlAsc(a, b) {
  let url1 = new URL(a.url);
  let url2 = new URL(b.url);

  return url1.hostname.localeCompare(url2.hostname);
}

function compareByUrlDesc(a, b) {
  let url1 = new URL(a.url);
  let url2 = new URL(b.url);

  return url2.hostname.localeCompare(url1.hostname);
}

function compareByDomainAsc(a, b) {
  let url1 = new URL(a.url);
  let url2 = new URL(b.url);

  let domain1 = url1.hostname.split(".").slice(-2).join(".");
  let domain2 = url2.hostname.split(".").slice(-2).join(".");

  return domain1.localeCompare(domain2);
}

function compareByDomainDesc(a, b) {
  let url1 = new URL(a.url);
  let url2 = new URL(b.url);

  let domain1 = url1.hostname.split(".").slice(-2).join(".");
  let domain2 = url2.hostname.split(".").slice(-2).join(".");

  return domain2.localeCompare(domain1);
}

function compareByTitleAsc(a, b) {
  return a.title.localeCompare(b.title);
}

function compareByTitleDesc(a, b) {
  return b.title.localeCompare(a.title);
}

function compareByLastAccessAsc(a, b) {
  if (a.lastAccessed < b.lastAccessed) {
    return -1;
  } else if (a.lastAccessed > b.lastAccessed) {
    return 1;
  } else {
    return 0;
  }
}

function compareByLastAccessDesc(a, b) {
  if (b.lastAccessed < a.lastAccessed) {
    return -1;
  } else if (b.lastAccessed > a.lastAccessed) {
    return 1;
  } else {
    return 0;
  }
}

/** Mapping of {@link menuDefs} IDs to URL comparator functions */
let menuIdToComparator = {
  "sort-by-url-asc": compareByUrlAsc,
  "sort-by-url-desc": compareByUrlDesc,
  "sort-by-domain-asc": compareByDomainAsc,
  "sort-by-domain-desc": compareByDomainDesc,
  "sort-by-last-access-asc": compareByLastAccessAsc,
  "sort-by-last-access-desc": compareByLastAccessDesc,
  "sort-by-title-asc": compareByTitleAsc,
  "sort-by-title-desc": compareByTitleDesc,
};

/**
 * Settings Functions
 */

/**
 * Adds/removes listener for automatic tab sorting.
 * Called when the setting for auto-sorting changes, or when the extension is first loaded.
 *
 * @see settingsSortAutoHandler
 *
 * @param {boolean} newValue The new value of the auto-sorting setting
 */
function onSettingsSortAuto(newValue) {
  if (newValue) {
    browser.tabs.onUpdated.addListener(settingsSortAutoHandler);
    browser.tabs.onCreated.addListener(settingsSortAutoHandler);
  } else {
    browser.tabs.onUpdated.removeListener(settingsSortAutoHandler);
    browser.tabs.onCreated.removeListener(settingsSortAutoHandler);
  }

  return Promise.resolve();
}

/**
 * No-op.
 * Called when the setting for sorting pinned tabs changes.
 *
 * @param {boolean} newValue The new value of the pinned tab sorting setting
 */
function onSettingsSortPinned(newValue) {
  return Promise.resolve();
}

/** Mapping of {@link settingsDefs} IDs to on-change functions */
let settingsMenuIdToHandler = {
  "settings-sort-auto": onSettingsSortAuto,
  "settings-sort-pinned": onSettingsSortPinned,
};

/**
 * Returns the settings stored in browser persistent storage,
 * initializing them if they aren't already there.
 *
 * @returns {Promise} A Promise containing the current settings
 */
function initializeSettings() {
  const defaultDict = {
    "last-comparator": undefined,
    "settings-sort-auto": false,
    "settings-sort-pinned": false,
  };
  return browser.storage.local.get(defaultDict);
}

/**
 * Listener for tabs.onCreated and tabs.onUpdated that automatically sorts tabs.
 *
 * @see onSettingsSortAuto
 */
function settingsSortAutoHandler() {
  initializeSettings().then((settings) => {
    if (menuIdToComparator[settings["last-comparator"]] !== undefined) {
      return sortTabs(
        menuIdToComparator[settings["last-comparator"]],
        settings
      );
    } else {
      console.warning(
        "Tried to automatically sort tabs but couldn't find the last-comparator. Doing nothing instead."
      );
    }
  }, onError);
}

/**
 * Tab sorting functions
 */

/**
 * Sorts tabs given a comparator function and the current tab-sorting settings
 *
 * @param {function} comparator The comparator function to compare URLs
 * @param settings The current tab-sorting settings
 * @returns {Promise} A Promise which will be fulfilled once tabs are sorted
 */
function sortTabs(comparator, settings) {
  return browser.tabs
    .query({
      currentWindow: true,
    })
    .then((tabs) => {
      const pinnedTabs = [];
      const normalTabs = [];
      for (const tab of tabs) {
        if (tab.pinned) pinnedTabs.push(tab);
        else normalTabs.push(tab);
      }
      if (settings["settings-sort-pinned"]) {
        sortTabsInternal(pinnedTabs, comparator);
      }
      sortTabsInternal(normalTabs, comparator);
    });
}

/**
 * Internal function for sorting a set of tabs
 *
 * @param {Tab[]} tabs The tabs which will be sorted
 * @param {function} comparator The comparator to use on URLs
 */
function sortTabsInternal(tabs, comparator) {
  if (tabs.length == 0) return;

  const offset = tabs[0].index;
  const beforeIds = tabs.map((tab) => tab.id);
  const afterIds = tabs
    .slice(0)
    .sort(comparator)
    .map((tab) => tab.id);
  let currentIds = beforeIds.slice(0);
  for (const difference of differ.diff(beforeIds, afterIds)) {
    if (!difference.added) continue;
    const movingIds = difference.value;
    const lastMovingId = movingIds[movingIds.length - 1];
    const nearestFollowingIndex = afterIds.indexOf(lastMovingId) + 1;
    let newIndex =
      nearestFollowingIndex < afterIds.length
        ? currentIds.indexOf(afterIds[nearestFollowingIndex])
        : -1;
    if (newIndex < 0) newIndex = beforeIds.length;
    const oldIndex = currentIds.indexOf(movingIds[0]);
    if (oldIndex < newIndex) newIndex--;
    browser.tabs.move(movingIds, {
      index: newIndex + offset,
    });
    currentIds = currentIds.filter((id) => !movingIds.includes(id));
    currentIds.splice(newIndex, 0, ...movingIds);
  }
}

/**
 * "public" API - functions which are called from the popup in popup/sortabs.js
 */

/**
 * Called when a setting has changed.
 * Updates local storage, and handles any necessary background state changes
 * e.g. adding/removing listeners.
 *
 * @param {string} settingId The ID of the changed setting
 * @param {boolean} newValue The new value of the changed setting
 */
function settingChanged(settingId, newValue) {
  // First, call the handler
  return settingsMenuIdToHandler[settingId](newValue).then((e) => {
    // Once that's finished, store the new value of the setting
    return browser.storage.local.set({
      [settingId]: newValue,
    });
  }, onError);
}

/**
 * Sort the tabs using the given comparator and current settings state.
 * @see menuIdToComparator
 * @see sortTabs
 *
 * @param {string} compName The ID of the comparator to use
 * @param settings Current tab-sorting settings
 * @returns {Promise} A Promise which will be fulfilled once tabs are sorted.
 */
function sortTabsComparatorName(compName, settings) {
  return sortTabs(menuIdToComparator[compName], settings);
}

/** Simple error handling function */
function onError(error) {
  console.trace(error);
}

// When the extension is loaded, check if the auto-sort setting is checked and immediately add handlers
document.addEventListener("DOMContentLoaded", (evt) => {
  initializeSettings().then((settings) => {
    onSettingsSortAuto(settings["settings-sort-auto"]);
  }, onError);
});
