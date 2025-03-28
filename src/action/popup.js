"use strict";

let waitForLoad = false; // Track whether we are loading a new URL

const statusText = $("#status-text");
const scanPostsButton = $("#scan-posts");
const toggleMenuButton = $("#toggle-menu");
const connectedButtons = [scanPostsButton, toggleMenuButton];
const unstyleButton = $("#unstyle-blog");

scanPostsButton.click(() => {
  chrome.runtime.sendMessage({ data: { event: "ts-target-articles" } });
});
toggleMenuButton.click(() => {
  chrome.runtime.sendMessage({ data: { event: "ts-menu-toggle" } });
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
    connectedButtons.forEach((item) => item.attr("disabled", ""));
    return;
  }

  // Check if we're on a real page
  if (!isCustomSubdomain) {
    statusText.text("Checking Connection...");
    const response = await chrome.runtime.sendMessage({ data: {} });
    if (response.success) {
      statusText.text("Connected!").addClass("success", "hidden-option");
      connectedButtons.forEach((item) => item.removeClass("hidden-option"));
      unstyleButton.addClass("hidden-option");
    } else {
      statusText.text("Disconnected...").addClass("error");
    }
  } else {
    // If we're on a custom subdomain, instead have a button to swap to the normal version of the page
    statusText.text("styled blog, must unstyle");
    connectedButtons.forEach((item) => item.addClass("hidden-option"));
    unstyleButton.removeClass("hidden-option");
  }
}

async function init() {
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
