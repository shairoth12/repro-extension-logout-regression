console.log("Test console log from a third-party execution context");

// Check login state on page load
chrome.runtime.sendMessage({action: 'getAuthState'}, response => {
  if (response && response.isLoggedIn) {
    console.log(`Content script: User ${response.username} is logged in`);
  } else {
    console.log('Content script: No user is logged in');
  }
});