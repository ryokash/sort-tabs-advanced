/**
 * Sort tabs web extension
 */

/**
 * Sort-type metadata
 * @see {menuDefs}
 *
 * @typedef {Object} SortMetadata
 * @property {string} id - Unique ID, used in background.js to match to a comparator
 * @property {string} title - User-facing title
 * @property {string[]} contexts - Unused, seems to correspond to usage from @link{https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/create menus.create()}
 * @property {Object} icons - Unused, seems to correspond to usage from @link{https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/create menus.create()}
 */

/**
 * Metadata for each available sort type
 * @type {SortMetadata[]}
 */
let menuDefs = [
  {
    id: "sort-by-url-asc",
    title: "sort by url (asc)",
    contexts: ["tools_menu", "browser_action"],
    icons: {
      16: "icons/sort-icon-url-asc-16.png",
    },
  },
  {
    id: "sort-by-url-desc",
    title: "sort by url (desc)",
    contexts: ["tools_menu", "browser_action"],
    icons: {
      16: "icons/sort-icon-url-desc-16.png",
    },
  },
  {
    id: "sort-by-domain-asc",
    title: "sort by domain (asc)",
    contexts: ["tools_menu", "browser_action"],
    icons: {
      16: "icons/sort-icon-domain-asc-16.png",
    },
  },
  {
    id: "sort-by-domain-desc",
    title: "sort by domain (desc)",
    contexts: ["tools_menu", "browser_action"],
    icons: {
      16: "icons/sort-icon-domain-desc-16.png",
    },
  },
  {
    id: "sort-by-title-asc",
    title: "sort by title (asc)",
    contexts: ["tools_menu", "browser_action"],
    icons: {
      16: "icons/sort-icon-title-asc-16.png",
    },
  },
  {
    id: "sort-by-title-desc",
    title: "sort by title (desc)",
    contexts: ["tools_menu", "browser_action"],
    icons: {
      16: "icons/sort-icon-title-desc-16.png",
    },
  },
  {
    id: "sort-by-last-access-asc",
    title: "sort by last access (asc)",
    contexts: ["tools_menu", "browser_action"],
    icons: {
      16: "icons/sort-icon-access-time-asc-16.png",
    },
  },
  {
    id: "sort-by-last-access-desc",
    title: "sort by last access (desc)",
    contexts: ["tools_menu", "browser_action"],
    icons: {
      16: "icons/sort-icon-access-time-desc-16.png",
    },
  },
];

/**
 * Settings metadata
 * @see {settingsDefs}
 *
 * @typedef {Object} SettingMetadata
 * @property {string} id - Unique ID, used in background.js
 * @property {string} title - User-facing title
 * @property {string[]} contexts - Unused, seems to correspond to usage from @link{https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/create menus.create()}
 */

/**
 * Metadata for each available setting
 * @type {SettingMetadata[]}
 */
let settingsDefs = [
  {
    id: "settings-sort-auto",
    title: "sort automatically",
    contexts: ["tools_menu", "browser_action"],
  },
  {
    id: "settings-sort-pinned",
    title: "sort pinned tabs",
    contexts: ["tools_menu", "browser_action"],
  },
];

/** Simple error handling function */
function onError(error) {
  console.trace(error);
}

/**
 * Initialization functions
 */

/**
 * Returns the settings stored in browser persistent storage,
 * initializing them if they aren't already there.
 */
function initializeSettings() {
  let defaultDict = settingsDefs.reduce(
    (acc, cur, idx, src) => Object.assign(acc, { [cur.id]: false }),
    {}
  );
  return browser.storage.local.get(defaultDict);
}

/**
 * Click handler for buttons corresponding to sort types
 * e.g. "sort by url (asc)"
 * Sorts the tabs by the specified comparator,
 * then saves that comparator as the 'last-comparator' setting.
 *
 * @param evt The click event for the setting button
 * @param settings The tab-sorting settings at time of button creation
 */
function clickHandler(evt, settings) {
  let backgroundWindow = browser.runtime.getBackgroundPage();
  backgroundWindow
    // Perform sorting
    .then((w) => w.sortTabsComparatorName(evt.target.id, settings))
    // Store this as the last used comparator
    .then((tab) => {
      console.log("Sort click handler: " + evt.target.id);
      return browser.storage.local
        .set({
          "last-comparator": evt.target.id,
        })
        .then(() => window.close(), onError);
    }, onError);
}

/**
 * Creates a button for a given sort type
 *
 * @param {SortMetadata} buttonDef Metadata for the given sort type
 * @param settings The tab-sorting settings at time of creation
 * @returns A clickable element that triggers {@link clickHandler}
 */
function createButton(buttonDef, settings) {
  let newEl = document.createElement("div");
  newEl.id = buttonDef.id;
  newEl.innerText = buttonDef.title;
  newEl.addEventListener("click", (evt) => clickHandler(evt, settings));
  return newEl;
}

/**
 * Click handler for buttons corresponding to settings
 * e.g. "sort automatically"
 * Finds the background page, then tells that page a setting has changed.
 *
 * @param evt The click event for the setting button
 * @param settings (Unused) The tab-sorting settings at time of creation
 */
function settingsClickHandler(evt, settings) {
  let backgroundWindow = browser.runtime.getBackgroundPage();
  return backgroundWindow.then((w) =>
    w.settingChanged(evt.target.id, evt.target.checked)
  );
}

/**
 * Creates a checkbox for a given setting
 *
 * @param {SettingMetadata} buttonDef Metadata for the given setting
 * @param settings The tab-sorting settings at time of creation
 * @returns A checkbox that reflects the setting's state, and toggles it with {@link settingsClickHandler} on-click.
 */
function createSettingsToggle(buttonDef, settings) {
  let newEl = document.createElement("div");
  newEl.id = buttonDef.id;
  let checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = buttonDef.id;
  checkbox.name = buttonDef.id;
  let label = document.createElement("label");
  label.innerText = buttonDef.title;
  label.htmlFor = buttonDef.id;
  checkbox.checked = settings[buttonDef.id];

  newEl.appendChild(checkbox);
  newEl.appendChild(label);
  newEl.addEventListener("click", (evt) => settingsClickHandler(evt, settings));
  return newEl;
}

/**
 * Creates the popup menu from {@link menuDefs}, {@link settingsDefs}
 *
 * @param settings The tab-sorting settings at time of creation
 */
function createPopup(settings) {
  console.log(settings);
  const settingsGroup = document.createElement("div");
  const settingsButtons = settingsDefs.map((def) =>
    createSettingsToggle(def, settings)
  );
  settingsButtons.forEach((button) => settingsGroup.appendChild(button));

  const buttons = menuDefs.map((menuDef) => createButton(menuDef, settings));
  const buttonGroup = document.createElement("div");
  buttons.forEach((button) => buttonGroup.appendChild(button));

  let cont = document.getElementById("options");
  cont.appendChild(buttonGroup);
  cont.appendChild(document.createElement("hr"));
  let settingsCont = document.getElementById("settings");
  settingsCont.appendChild(settingsGroup);
}

// When the popup opens, initialize the settings and create the popup menu
document.addEventListener("DOMContentLoaded", (evt) => {
  initializeSettings().then((settings) => {
    createPopup(settings);
  }, onError);
});
