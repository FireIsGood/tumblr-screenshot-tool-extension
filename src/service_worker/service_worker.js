async function relayToContent(data) {
  let response = { success: false };

  const tabList = await chrome.tabs.query({ active: true, currentWindow: true });
  response = chrome.tabs.sendMessage(tabList[0].id, { data });

  return response;
}

function init() {
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (sender.id !== chrome.runtime.id) return;

    console.log("From Action to Content Script:", request);
    relayToContent(request.data).then((response) => {
      console.log("From Content Script to Action:", response);
      sendResponse(response);
    });

    // Enable async return
    return true;
  });
}

init();
