/**
 * SENTINEL Background Service Worker
 * Handles network requests to bypass HTTPS -> HTTP mixed content blocks on broker websites.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeTrade") {
    // Forward the analysis request to the local FastAPI backend
    fetch('http://localhost:8000/api/analyze-trade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request.payload)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      sendResponse({ success: true, data: data });
    })
    .catch(error => {
      console.error("SENTINEL Background Fetch Error:", error);
      sendResponse({ success: false, error: error.toString() });
    });

    // Return true to indicate that the response will be sent asynchronously
    return true; 
  }
});
