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
  [...document.querySelectorAll(".ts-ring-selector")].forEach((elem) => elem.remove());
}

function selectArticles() {
  closeMenu();
  removeTargetRings();

  // Add rings to all visible posts
  const allPosts = [...document.querySelectorAll("#base-container article")];
  const visiblePosts = allPosts.filter((elem) => isVisible(elem));
  visiblePosts.forEach((elem) => addTargetingRing(elem));
}

function createMenu() {
  // Idempotency
  if (document.querySelector("#ts-menu") !== null) return;

  const menuElement = document.createElement("div");
  menuElement.id = "ts-menu";

  // Close button
  const closeButtonElement = document.createElement("div");
  closeButtonElement.classList.add("ts-button", "icon-only", "ts-close-button");
  closeButtonElement.innerHTML = "&times;";
  closeButtonElement.addEventListener("click", closeMenu);
  menuElement.append(closeButtonElement);

  // Render container (secret spot to render the post)
  const renderContainer = document.createElement("div");
  renderContainer.id = "ts-render-container";
  menuElement.append(renderContainer);
  const renderScrollerElement = document.createElement("div");
  renderScrollerElement.classList.add("ts-scroller");
  renderContainer.append(renderScrollerElement);
  const renderWrapper = document.createElement("div");
  renderWrapper.id = "ts-render-wrapper";
  renderScrollerElement.append(renderWrapper);
  const renderWrapperInner = document.createElement("div");
  renderWrapperInner.id = "ts-render-wrapper-inner";
  renderWrapper.append(renderWrapperInner);

  // Layout container (things go here wow)
  const layoutContainer = document.createElement("div");
  layoutContainer.classList.add("ts-menu-layout");
  menuElement.append(layoutContainer);

  // Output container (where the canvas goes)
  const outputContainer = document.createElement("div");
  outputContainer.id = "ts-output-container";
  outputContainer.classList.add("ts-card");
  layoutContainer.append(outputContainer);
  const scrollerElement = document.createElement("div");
  scrollerElement.classList.add("ts-scroller");
  outputContainer.append(scrollerElement);
  const outputInner = document.createElement("div");
  outputInner.id = "ts-output-inner";
  scrollerElement.append(outputInner);

  const progressElement = document.createElement("p");
  progressElement.id = "ts-progress-element";
  outputContainer.prepend(progressElement);

  // Controls container
  const controlsContainer = document.createElement("div");
  controlsContainer.classList.add("ts-controls");
  layoutContainer.append(controlsContainer);

  // Settings
  const settingsContainer = document.createElement("fieldset");
  settingsContainer.classList.add("ts-settings");
  const settingsLegend = document.createElement("legend");
  settingsLegend.innerText = "Settings";
  settingsContainer.append(settingsLegend);
  controlsContainer.append(settingsContainer);

  // Placeholder option
  const placeholderElement = document.createElement("input");
  placeholderElement.type = "checkbox";
  placeholderElement.id = "placeholder-option";
  const placeholderLabelElement = document.createElement("label");
  placeholderLabelElement.innerText = "Placeholder option (wow!)";
  placeholderLabelElement.setAttribute("for", "placeholder-option");
  settingsContainer.append(placeholderElement);
  settingsContainer.append(placeholderLabelElement);

  // Output buttons
  const outputButtonsContainer = document.createElement("fieldset");
  outputButtonsContainer.classList.add("ts-horizontal-buttons");
  const outputButtonsLegend = document.createElement("legend");
  outputButtonsLegend.innerText = "Output";
  outputButtonsContainer.append(outputButtonsLegend);
  controlsContainer.append(outputButtonsContainer);

  // Save button
  const saveButtonElement = document.createElement("button");
  saveButtonElement.innerText = "Save";
  saveButtonElement.classList.add("ts-button");
  outputButtonsContainer.append(saveButtonElement);
  saveButtonElement.addEventListener("click", () => {
    const img = document.querySelector("#ts-output-inner > canvas");
    downloadCanvas(img, "post.png");
  });

  // Copy button
  const copyButtonElement = document.createElement("button");
  copyButtonElement.innerText = "Copy";
  copyButtonElement.classList.add("ts-button");
  outputButtonsContainer.append(copyButtonElement);
  copyButtonElement.addEventListener("click", () => {
    const img = document.querySelector("#ts-output-inner > canvas");
    img.toBlob((blob) => {
      navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
    });
  });

  document.body.append(menuElement);
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
