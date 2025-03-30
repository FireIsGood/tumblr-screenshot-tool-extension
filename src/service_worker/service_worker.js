async function relayToContent(data) {
  let response = { success: false };

  const tabList = await chrome.tabs.query({ active: true, currentWindow: true });
  response = chrome.tabs.sendMessage(tabList[0].id, { data });

  return response;
}

// Mirrors messages from the Action to the active tab
// NOTE: This *must* be sync and return the value "true" to actually work.
function handleMessages(request, sender, sendResponse) {
  if (sender.id !== chrome.runtime.id) return;

  console.log("From Action to Content Script:", request);
  relayToContent(request.data).then((response) => {
    console.log("From Content Script to Action:", response);
    sendResponse(response);
  });

  // Enable async return
  return true;
}

function init() {
  chrome.runtime.onMessage.addListener(handleMessages);
}

init();
