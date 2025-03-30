"use strict";

function handleExternalEvents(request, sender, sendResponse) {
  if (sender.id !== chrome.runtime.id) return;
  document.documentElement.dispatchEvent(new CustomEvent(request.data.event));
  sendResponse({ success: true });
  return true;
}

function downloadCanvas(canvasImg, fileName) {
  const downloadLink = document.createElement("a");
  downloadLink.href = canvasImg.toDataURL();
  downloadLink.download = fileName;
  downloadLink.click();
}

function isVisible(elem) {
  const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
  const rect = elem.getBoundingClientRect();

  const above = rect.bottom < 0;
  const below = rect.top - viewHeight >= 0;
  const visible = !(above || below);

  return visible;
}

function addTargetingRing(postElem) {
  const ringElement = document.createElement("div");
  ringElement.classList.add("ts-ring-selector");

  // Make it line up initially and on change
  const alignRing = function () {
    const rect = postElem.getBoundingClientRect();
    ringElement.style.top = rect.top + window.scrollY + "px";
    ringElement.style.left = rect.left + window.scrollX + "px";
    ["width", "height"].forEach((dimension) => {
      ringElement.style[dimension] = rect[dimension] + "px";
    });
  };
  alignRing();

  // Observer for on body change
  const mutationObserver = new MutationObserver(() => alignRing());
  mutationObserver.observe(document.body, { attributes: true, childList: true, subtree: true });

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

  // Add controls
  const selectButton = document.createElement("button");
  selectButton.classList.add("ts-button");
  selectButton.innerText = "Select";
  selectButton.addEventListener("click", async () => {
    removeTargetRings();
    openMenu();
    await loadPostIntoMenu(postElem);
  });
  ringElement.append(selectButton);

  const copyButton = document.createElement("button");
  copyButton.classList.add("ts-button");
  copyButton.innerText = "Copy";
  copyButton.addEventListener("click", async () => {
    navigator.clipboard.writeText(postElem.outerHTML);
  });
  ringElement.append(copyButton);

  document.body.append(ringElement);
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
  const renderContainer = document.querySelector("#ts-render-wrapper-inner");
  renderContainer.innerHTML = "";
  renderContainer.append(postCopy);

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
