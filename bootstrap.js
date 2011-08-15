const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "imgTools",
                                   "@mozilla.org/image/tools;1",
                                   "imgITools");
XPCOMUtils.defineLazyServiceGetter(this, "faviconSvc",
                                   "@mozilla.org/browser/favicon-service;1",
                                   "nsIFaviconService");
XPCOMUtils.defineLazyServiceGetter(this, "taskbar",
                                   "@mozilla.org/windows-taskbar;1",
                                   "nsIWinTaskbar");

// Default preferences
const PREF_BRANCH = "extensions.taskbaroverlaytester.";
const PREFS = {
  iconURL: "chrome://mozapps/skin/places/defaultFavicon.png",
};

function setDefaultPrefs() {
  let branch = Services.prefs.getDefaultBranch(PREF_BRANCH);
  for (let [key, val] in Iterator(PREFS)) {
    switch (typeof val) {
      case "boolean":
        branch.setBoolPref(key, val);
        break;
      case "number":
        branch.setIntPref(key, val);
        break;
      case "string":
        branch.setCharPref(key, val);
        break;
    }
  }
}

/**
 * Given an nsIURI referring to an image, calls the callback with an
 * imgIContainer for the image. Copied from WindowsPreviewPerTab.jsm.
 */
function _imageFromURI(uri, callback) {
  let channel = Services.io.newChannelFromURI(uri);
  NetUtil.asyncFetch(channel, function(inputStream, resultCode) {
    if (!Components.isSuccessCode(resultCode))
      return;
    let out_img = { value: null };
    imgTools.decodeImageData(inputStream, channel.contentType, out_img);
    callback(out_img.value);
  });
}

function findActiveWindow() {
  // Look for an active window
  let windows = Services.wm.getEnumerator(null);
  let win = windows.hasMoreElements() ?
    windows.getNext().QueryInterface(Ci.nsIDOMWindow) :
    null;
  setActiveWindow(win);
}

var gActiveWindow = null;
function setActiveWindow(aWin) {
  // We're assuming that if gActiveWindow is non-null, we only get called when
  // it's closed.
  gActiveWindow = aWin;
  if (gActiveWindow)
    updateOverlayIcon();
}

var gWindowObserver = {
  observe: function gWindowObserver_observe(aSubject, aTopic, aData) {
    // Look for domwindowopened and domwindowclosed messages
    let win = aSubject.QueryInterface(Ci.nsIDOMWindow);
    switch (aTopic) {
    case "domwindowopened":
      if (!gActiveWindow)
        setActiveWindow(win);
      break;
    case "domwindowclosed":
      if (win == gActiveWindow)
        findActiveWindow();
      break;
    }
  } 
};

var gPrefObserver = {
  observe: function gPrefObserver_observe(aSubject, aTopic, aData) {
    if (aData == PREF_BRANCH + "iconURL")
      setOverlayIconFromPref();
  }
};

function setOverlayIconFromPref() {
  let spec = Services.prefs.getCharPref(PREF_BRANCH + "iconURL");
  let url = null;
  try {
    url = Services.io.newURI(spec, null, null);
  } catch (ex) {
    // The URL's malformed, so just ignore it.
  }
  setOverlayIcon(url);
}

var gIconURL = null;
function setOverlayIcon(aIconURL) {
  gIconURL = aIconURL;
  if (gActiveWindow)
    updateOverlayIcon();
}

// This should only be called if gActiveWindow is non-null
function updateOverlayIcon() {
  // aka magic
  let docshell = gActiveWindow.QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShellTreeItem)
    .treeOwner.QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIXULWindow).docShell;

  let controller = taskbar.getOverlayIconController(docshell);
  if (gIconURL) {
    _imageFromURI(gIconURL,
      function (aIcon) {
        controller.setOverlayIcon(aIcon, "icon description string");
      });
  }
  else {
    controller.setOverlayIcon(null, "");
  }
}

function startup(aData, aReason) {
  setDefaultPrefs();

  if (!taskbar.available)
    return;
  Services.ww.registerNotification(gWindowObserver);
  Services.prefs.addObserver(PREF_BRANCH, gPrefObserver, false);
  findActiveWindow();
  setOverlayIconFromPref();
}

function shutdown(aData, aReason) {
  Services.ww.unregisterNotification(gWindowObserver);
  Services.prefs.removeObserver(PREF_BRANCH, gPrefObserver);
  setOverlayIcon(null);
}
