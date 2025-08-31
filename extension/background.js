console.log("Service worker script loaded");

// Store auth state
let authState = {
  isLoggedIn: false,
  username: null,
  token: null
};

// Check for stored login state on startup
chrome.storage.local.get(['isLoggedIn', 'username', 'token'], function(result) {
  if (result.isLoggedIn) {
    authState.isLoggedIn = true;
    authState.username = result.username;
    authState.token = result.token;
    console.log(`Restored login state for ${authState.username}`);
  }
});

// Flag to detect test environment
let isTestEnvironment = false;

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'login') {
    authState.isLoggedIn = true;
    authState.username = message.username;
    authState.token = message.token;
    
    // Store auth state persistently
    chrome.storage.local.set({
      isLoggedIn: true, 
      username: message.username,
      token: message.token
    });
    
    console.log(`Background: User ${message.username} logged in`);
    sendResponse({success: true});
  } 
  else if (message.action === 'logout') {
    console.log(`Background: User ${message.previousUser || 'unknown'} logged out`);
    console.log("Background: Full message:", JSON.stringify(message));
    
    // Clear auth state
    authState.isLoggedIn = false;
    authState.username = null;
    authState.token = null;
    
    // Clear stored auth state
    chrome.storage.local.remove(['isLoggedIn', 'username', 'token']);
    
    // Send response immediately
    sendResponse({success: true});
    
    // Check if this is from a test run
    isTestEnvironment = false; // message.isTestMode === true || 
                      //  (sender.url && sender.url.includes('test=true'));
    
    // Handle reload request if specified
    if (message.requestReload) {
      console.log("Background: Preparing to reload extension...");
      
      // Check if we're in test environment
      if (isTestEnvironment) {
        console.log("Background: Skipping extension reload as we're in test environment");
      } else {
        // Add a delay to ensure the response is sent and UI is updated
        setTimeout(() => {
          console.log("Background: Reloading extension now");
          
          try {
            // This will reload the entire extension
            chrome.runtime.reload();
          } catch (error) {
            console.error("Failed to reload extension:", error);
          }
        }, 1500); // Allow enough time for UI updates and test verification
      }
    }
  }
  else if (message.action === 'getAuthState') {
    sendResponse(authState);
  }
  else if (message.action === 'setTestMode') {
    // isTestEnvironment = true;
    console.log("Background: Test mode enabled");
    sendResponse({success: true});
  }
  return true; // Keep the message channel open for async response
});

// When extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  
  // Create a context menu item to open the login page
  chrome.contextMenus.create({
    id: 'openLoginPage',
    title: 'Open Login Page',
    contexts: ['all']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openLoginPage') {
    // Open the login page in a new tab
    chrome.tabs.create({url: chrome.runtime.getURL('login.html')});
  }
});

// Listen for extension reload events
chrome.runtime.onRestartRequired.addListener((reason) => {
  console.log("Extension restart required due to:", reason);
});

// Create a content script to log messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'log') {
    console.log("Content script log:", message.text);
    sendResponse({received: true});
  }
});