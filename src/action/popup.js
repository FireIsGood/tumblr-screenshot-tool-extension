"use strict";

const debug = false; // For now just shows status messages

let waitForLoad = false; // Track whether we are loading a new URL
let scanning = false;

const statusElem = $("#status");
const statusText = $("#status-text");
const menuControls = $("#menu-controls");
const enableScansButton = $("#enable-scans");
const disableScansButton = $("#disable-scans");
const connectedButtons = [enableScansButton, disableScansButton];
const unstyleButton = $("#unstyle-blog");
const alertMessage = $("#alert-message");
const alertMessageText = $("#alert-message-text");

enableScansButton.click(() => {
  chrome.runtime.sendMessage({ data: { event: "ts-enable-targeting" } });
  scanning = true;
  enableScansButton.addClass("hidden");
  disableScansButton.removeClass("hidden");
});
disableScansButton.click(() => {
  chrome.runtime.sendMessage({ data: { event: "ts-disable-targeting" } });
  scanning = false;
  disableScansButton.addClass("hidden");
  enableScansButton.removeClass("hidden");
});
unstyleButton.click(async () => {
  unstyleButton.attr("disabled", "");

  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(currentTab.url);

  // Modify URL
  const blogName = url.host.split(".")[0];
  let path = url.pathname.split("/");
  path[1] = blogName;
  path = path.join("/");
  url.host = "www.tumblr.com";
  url.pathname = path;

  // Go to it
  chrome.tabs.update({ url: url.toString() });
});

// Check if we are connected to the client
async function checkConnection() {
  // If we're on the right tab, load up
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(currentTab.url);

  const isTumblrHost = url.host.split(".")[1] === "tumblr";
  const isCustomSubdomain = url.host.split(".")[0] !== "www";

  // Ignore pages that we wouldn't connect to
  if (!isTumblrHost) {
    statusText.text("Invalid website!");
    menuControls.addClass("hidden");
    alertMessage.removeClass("hidden");
    alertMessageText.text("This is not Tumblr");
    alertMessageText.addClass("error");
    return;
  }

  // If we're on a custom subdomain, instead have a button to swap to the normal version of the page
  if (isCustomSubdomain) {
    statusText.text("styled blog, must unstyle");
    connectedButtons.forEach((item) => item.addClass("hidden"));
    unstyleButton.removeClass("hidden");
    return;
  }

  // We're on the actual website!
  statusText.text("Checking Connection...");
  const response = await chrome.runtime.sendMessage({ data: {} });
  if (response.success) {
    statusText.text("Connected!").addClass("success", "hidden");
    connectedButtons.forEach((item) => item.removeClass("hidden"));
    unstyleButton.addClass("hidden");
  } else {
    statusText.text("Disconnected...").addClass("error");
  }
}

async function init() {
  if (debug) {
    statusElem.removeClass("hidden");
  }

  checkConnection();

  // Add listeners
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, _tab) => {
    if (changeInfo.url) {
      waitForLoad = true;
    }
    if (changeInfo.status === "complete") {
      waitForLoad = false;
      checkConnection();
    }
  });
}

init();
