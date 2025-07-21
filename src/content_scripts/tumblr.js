"use strict";

// Relays external events from the extension api
function handleExternalEvents(request, sender, sendResponse) {
  if (sender.id !== chrome.runtime.id) return;
  document.documentElement.dispatchEvent(new CustomEvent(request.data.event));
  sendResponse({ success: true });
  return true;
}

// Downloads a given canvas element under the specified file name
function downloadCanvas(canvasImg, fileName) {
  const downloadLink = document.createElement("a");
  downloadLink.href = canvasImg.toDataURL();
  downloadLink.download = fileName;
  downloadLink.click();
}

// Returns whether a given element is at all visible
function isVisible(elem) {
  const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
  const rect = elem.getBoundingClientRect();

  const above = rect.bottom < 0;
  const below = rect.top - viewHeight >= 0;
  const visible = !(above || below);

  return visible;
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
  const ringElement = $('<div class="ts-ring-selector"></div>');

  // Make it line up initially and on change
  const alignRing = () => {
    const rect = postElem.getBoundingClientRect();
    ringElement.css({
      top: rect.top + window.scrollY + "px",
      left: rect.left + window.scrollX + "px",
      width: rect.width + "px",
      height: rect.height + "px",
    });
  };
  alignRing();

  // Add controls
  const onHideCallback = [];
  const disableOnNotes = [];
  const updateCloseNotesButton = (elem) => {
    if ($(postElem).find("div.ePsyd").length === 0) {
      elem.addClass("hidden");
      disableOnNotes.forEach((elem) => elem.prop("disabled", false));
      return;
    }
    elem.removeClass("hidden");
    disableOnNotes.forEach((elem) => elem.prop("disabled", true));
  };
  const closeNotesButton = $('<button class="ts-ring-button">Close Notes</button>').click((event) => {
    $(postElem).find("div.ePsyd").click();
    $(event.target).addClass("hidden");
    onHideCallback.forEach((fn) => fn());
  });
  if ($(postElem).find("div.ePsyd").length !== 0) {
    closeNotesButton.addClass("hidden");
  }
  closeNotesButton.appendTo(ringElement);

  const keepReadingButton = $(postElem).find('[aria-label="Keep reading"]');
  const expandPostButton = $('<button class="ts-ring-button secondary">Expand Post</button>').click((event) => {
    keepReadingButton.click();
    $(event.target).remove();
  });
  if (keepReadingButton.length !== 0) {
    expandPostButton.appendTo(ringElement);
  }

  const resetSelect = debounce((elem, text) => {
    elem.innerText = text;
  }, 750);
  const selectButton = $('<button class="ts-ring-button primary">Select</button>')
    .click((event) => {
      openMenu();
      loadPostIntoMenu(postElem);
      event.target.innerText = "Selected!";
      resetSelect(event.target, "Select");
    })
    .appendTo(ringElement);
  disableOnNotes.push(selectButton);
  onHideCallback.push(() => selectButton.prop("disabled", false));

  const resetCopy = debounce((elem, text) => {
    elem.innerText = text;
  }, 750);
  const copyButton = $('<button class="ts-ring-button primary">Copy HTML</button>').click((event) => {
    navigator.clipboard.writeText(postElem.outerHTML);
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
      ringElement.remove();
    })
    .appendTo(ringElement);

  onHideCallback.push(() => console.log("HI"));

  // Initial check
  updateCloseNotesButton(closeNotesButton);

  // Observer for on body change
  const mutationObserver = new MutationObserver(() => {
    alignRing();
    updateCloseNotesButton(closeNotesButton);
    console.log("Root mutated");
  });
  mutationObserver.observe(document.getElementById("root"), { attributes: true, childList: true, subtree: true });
  const resizeObserver = new ResizeObserver(() => {
    alignRing();
  });
  resizeObserver.observe(document.body);

  // Remove the ring if it goes off screen
  const intersectionObserver = new IntersectionObserver(
    (entries, _observer) => {
      const entry = entries[0]; // We only observe one thing here

      if (!entry.isIntersecting) {
        ringElement.remove();
      }
    },
    { root: null }
  );
  intersectionObserver.observe(postElem);

  $("body").append(ringElement);
}

function removeTargetRings() {
  $(".ts-ring-selector").remove();
}

function selectArticles() {
  closeMenu();
  removeTargetRings();

  // Add rings to all visible posts
  $("#base-container article")
    .filter((_, elem) => isVisible(elem))
    .each((_, elem) => addTargetingRing(elem));
}

function createMenu() {
  // Idempotency
  if ($("#ts-menu")[0]) return;

  const menuElement = $(`<div id="ts-menu"></div>`);

  // Close button
  $(`<div class="ts-button icon-only ts-close-button">&times;</div>`).click(closeMenu).appendTo(menuElement);

  // Render container (secret spot to render the post)
  $(`
    <div id="ts-render-container">
      <div class="ts-scroller">
        <div id="ts-render-wrapper">
          <div id="ts-render-wrapper-inner"></div>
        </div>
      </div>
    </div>
  `).appendTo(menuElement);

  // Layout container (things go here wow)
  $(`
    <div class="ts-menu-layout">
      <div id="ts-output-container" class="ts-card">
        <div class="ts-scroller">
          <div id="ts-output-inner"></div>
        </div>
        <p id="ts-progress-element"></p>
      </div>
      <div class="ts-controls">
        <fieldset id="ts-settings">
          <legend>Settings</legend>
        </fieldset>
        <fieldset id="ts-output-controls" class="ts-horizontal-buttons">
          <legend>Output</legend>
        </fieldset>
      </div>
    </div>
  `).appendTo(menuElement);

  // Options (only a placeholder for now)
  $(`
    <input type="checkbox" id="placeholder-option"></input>
    <label for="placeholder-option">Placeholder option (wow!)</input>
  `).appendTo(menuElement.find("#ts-settings"));

  // Output buttons
  $(`
    <button class="ts-button">Save</button>
  `)
    .click(() => {
      const img = document.querySelector("#ts-output-inner > canvas");
      downloadCanvas(img, "post.png");
    })
    .appendTo(menuElement.find("#ts-output-controls"));

  // Copy button
  $(`
    <button class="ts-button">Copy</button>
  `)
    .click(() => {
      const img = document.querySelector("#ts-output-inner > canvas");
      img.toBlob((blob) => {
        navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
      });
    })
    .appendTo(menuElement.find("#ts-output-controls"));

  $("body").append(menuElement);
}

async function captureImage(postRoot, progressElem) {
  return await modernScreenshot.domToCanvas(postRoot, {
    debug: true,
    progress: (current, total) => {
      progressElem.innerText = `${current}/${total}`;
      console.log(`${current}/${total}`);
    },
  });
}

async function processPost(postRoot) {
  const postCopy = postRoot.cloneNode(true);
  // Replace SVG elements to be inline
  const svgToReplace = [...postCopy.querySelectorAll('use[href^="#"]')];
  svgToReplace.forEach((elem) => {
    const svgReplacement = document.querySelector(elem.getAttribute("href")).cloneNode(true);
    elem.replaceWith(svgReplacement);
  });

  // Replace Image elements with local elements
  const imgToReplace = [...postCopy.querySelectorAll("img")];
  imgToReplace.forEach((elem) => {
    const sources = elem.srcset.split(" ");
    const replacementUrl = sources[sources.length - 2];

    fetch(replacementUrl)
      .then((result) => result.blob())
      .then((blob) => {
        elem.removeAttribute("srcset");
        elem.src = URL.createObjectURL(blob);
      });
  });

  const timeToReplace = [...postCopy.querySelectorAll("time")];
  timeToReplace.forEach((elem) => {
    const timestamp = moment(elem.dateTime);
    elem.innerText = timestamp.format("MMM D, YYYY");
  });

  return postCopy;
}

function openMenu() {
  createMenu();
  const menuElement = document.querySelector("#ts-menu");
  menuElement.classList.add("open");
}

function closeMenu() {
  const menuElement = document.querySelector("#ts-menu");
  menuElement.classList.remove("open");
}

function toggleMenu() {
  const menuElement = document.querySelector("#ts-menu");
  if (menuElement === null || ![...menuElement.classList].includes("open")) {
    openMenu();
  } else {
    closeMenu();
  }
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitCondition(checkFunction) {
  while (checkFunction() === false) {
    await timeout(50);
  }
  return;
}

async function loadPostIntoMenu(postRoot) {
  createMenu();

  // Process and set aside to render
  const postCopy = await processPost(postRoot);
  $("#ts-render-wrapper-inner").empty().append(postCopy);

  // Render and display
  const renderOuter = document.querySelector("#ts-render-wrapper");
  const progressElement = document.querySelector("#ts-progress-element");
  const outputContainer = document.querySelector("#ts-output-inner");
  outputContainer.innerHTML = "";
  const renderedImage = await captureImage(renderOuter, progressElement);
  outputContainer.append(renderedImage);
}

async function init() {
  // Message passing
  chrome.runtime.onMessage.addListener(handleExternalEvents);

  // Other callbacks
  document.documentElement.addEventListener("ts-target-articles", selectArticles);
  document.documentElement.addEventListener("ts-menu-toggle", toggleMenu);

  // Create the menu element
  createMenu();

  console.log("%cScreenshot tool loaded!", "font-size: 2rem");
}

init();
