"use strict";

let scanPosts = false;
let count = 0;

// Relays external events from the extension api
function handleExternalEvents(request, sender, sendResponse) {
  if (sender.id !== chrome.runtime.id) return;
  document.documentElement.dispatchEvent(new CustomEvent(request.data.event));
  sendResponse({ success: true });
  return true;
}

// Runs a given function after a delay ignoring re-callings of it until the callback is run
const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
};

// Adds target rings to each of the elements with curried redrawing
function addTargetingRing(postElem) {
  if (postElem.querySelector(".ts-ring-selector")) return;

  // Set up alignment
  const computedStyle = window.getComputedStyle(postElem);
  if (computedStyle.position !== "relative") container.style.position = "relative";

  const ringElement = $('<div class="ts-ring-selector"></div>');

  // Add controls
  const onHideCallback = [];
  const disableOnNotes = [];
  const closeNotesButton = $('<button class="ts-ring-button">Close Notes</button>').click((event) => {
    $(postElem).find("div.ePsyd").click();
    $(event.target).addClass("hidden");
    onHideCallback.forEach((fn) => fn());
  });
  if ($(postElem).find("div.ePsyd").length !== 0) {
    closeNotesButton.addClass("hidden");
  }
  closeNotesButton.appendTo(ringElement);
  const updateCloseNotesButton = () => {
    if ($(postElem).find("div.ePsyd").length === 0) {
      closeNotesButton.addClass("hidden");
      disableOnNotes.forEach((closeNotesButton) => closeNotesButton.prop("disabled", false));
      return;
    }
    closeNotesButton.removeClass("hidden");
    disableOnNotes.forEach((closeNotesButton) => closeNotesButton.prop("disabled", true));
  };

  const keepReadingButton = $(postElem).find('[aria-label="Keep reading"]');
  const expandPostButton = $('<button class="ts-ring-button secondary">Expand Post</button>').click((event) => {
    keepReadingButton.click();
    $(event.target).remove();
  });
  if (keepReadingButton.length !== 0) {
    expandPostButton.appendTo(ringElement);
  }

  const resetCopy = debounce((elem, text) => {
    elem.innerText = text;
  }, 750);
  const copyButton = $('<button class="ts-ring-button primary">Copy HTML</button>').click((event) => {
    const postElemClean = $(postElem).clone();
    postElemClean.find(".ts-ring-selector").remove();
    navigator.clipboard.writeText(postElemClean.html());
    event.target.innerText = "Copied HTML!";
    resetCopy(event.target, "Copy HTML");
  });
  disableOnNotes.push(copyButton);
  onHideCallback.push(() => copyButton.prop("disabled", false));
  const websiteButton = $(
    '<a href="https://fireisgood.github.io/tumblr-screenshot-tool/" target="_blank" class="ts-web-link">website screenshotter</a>'
  );
  $(`<div class="ts-button-vertical-stack">
    </div>`)
    .append(copyButton)
    .append(websiteButton)
    .appendTo(ringElement);

  $('<button class="ts-ring-button">&times;</button>')
    .click(() => {
      scanPosts = false;
      $(".ts-ring-selector").remove();
    })
    .appendTo(ringElement);

  // Initial check
  updateCloseNotesButton(closeNotesButton);

  // Observer for on body change
  const mutationObserver = new MutationObserver(updateCloseNotesButton);
  mutationObserver.observe($(postElem).find("footer")[0], { attributes: true, childList: true, subtree: true });

  $(postElem).append(ringElement);
}

function enableTargeting() {
  scanPosts = true;
  selectArticles();
}

function disableTargeting() {
  scanPosts = false;
  $(".ts-ring-selector").remove();
}

function selectArticles() {
  if (!scanPosts) return;

  // Add rings to all visible posts
  $("#base-container article").each((_, elem) => addTargetingRing(elem));
}

function addMenuOption() {
  const menu = $("#glass-container [role='menu']");
  if (menu.find(".ts-scan-posts-button").length > 0) return;
  const newButton = $(
    '<button role="menuitem" class="X1uIE v_1X3 ts-scan-posts-button" style="color: RGB(var(--purple));">Scan Posts</button>'
  ).click(() => enableTargeting());

  menu.append(newButton);
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function init() {
  // Message passing
  chrome.runtime.onMessage.addListener(handleExternalEvents);

  // Other callbacks
  document.documentElement.addEventListener("ts-enable-targeting", enableTargeting);
  document.documentElement.addEventListener("ts-disable-targeting", disableTargeting);

  // Reselect articles when page updates
  const articleObserver = new MutationObserver(selectArticles);
  articleObserver.observe(document.getElementById("root"), { childList: true, subtree: true });

  // Add extra options to post options menu
  const menuObserver = new MutationObserver(addMenuOption);
  menuObserver.observe(document.getElementById("glass-container"), { childList: true, subtree: true });

  console.log("%cScreenshot tool loaded!", "font-size: 2rem");
}

init();
