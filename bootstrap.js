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

function setOverlayIcon(aIconURL) {
  // We're going to overlay the icon for the most recent browser/mail
  // window. If there isn't one, God help you.
  let win = Services.wm.getMostRecentWindow("navigator:browser") ||
            Services.wm.getMostRecentWindow("mail:3pane");

  // aka magic
  let docshell = win.QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShellTreeItem)
    .treeOwner.QueryInterface(Ci.nsIInterfaceRequestor)
    .getInterface(Ci.nsIXULWindow).docShell;

  let controller = taskbar.getOverlayIconController(docshell);
  if (aIconURL) {
    _imageFromURI(aIconURL,
      function (aIcon) {
        controller.setOverlayIcon(aIcon, "icon description string");
      });
  }
  else {
    controller.setOverlayIcon(null, "");
  }
}

function startup(aData, aReason) {
  if (!taskbar.available)
    return;
  setOverlayIcon(faviconSvc.defaultFavicon);
}

function shutdown(aData, aReason) {
  setOverlayIcon(null);
}
