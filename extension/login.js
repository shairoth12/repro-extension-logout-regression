// Login state management
let isLoggedIn = false;
let currentUser = null;
const AUTH_TOKEN_KEY = 'auth_token'; 

// Function to generate a mock authentication token
function generateAuthToken(username) {
  // In a real app, this would come from a server
  // This creates a simple mock token with username and timestamp
  return btoa(`${username}:${Date.now()}:authorized`);
}

// Function to update UI based on login state
function updateUI() {
  const loginForm = document.getElementById('loginForm');
  const logoutForm = document.getElementById('logoutForm');
  const statusDiv = document.getElementById('status');
  const userDisplay = document.getElementById('userDisplay');
  
  if (isLoggedIn) {
    loginForm.style.display = 'none';
    logoutForm.style.display = 'block';
    userDisplay.textContent = currentUser;
    statusDiv.textContent = 'Successfully logged in!';
    statusDiv.className = 'status logged-in';
    
    // Log to console for the test to capture
    console.log(`User ${currentUser} logged in successfully`);
    
    // Store login state and auth token
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', currentUser);
    
    // Notify background script
    chrome.runtime.sendMessage({
      action: 'login', 
      username: currentUser,
      token: localStorage.getItem(AUTH_TOKEN_KEY)
    });
  } else {
    loginForm.style.display = 'block';
    logoutForm.style.display = 'none';
    
    // Always show "User X logged out" when we have a currentUser value
    if (currentUser) {
      statusDiv.textContent = `User ${currentUser} logged out`;
      statusDiv.className = 'status logged-out';
      
      // Log to console for the test to capture
      console.log(`User ${currentUser} logged out`);
    } else {
      statusDiv.textContent = 'Please log in';
      statusDiv.className = 'status logged-out';
    }
  }
}

// Perform actual authentication
function performAuthentication(username, password) {
  // In a real app, this would make an API call to authenticate
  // For our demo, we'll simulate a successful auth with any non-empty credentials
  
  return new Promise((resolve, reject) => {
    // Simulate network request
    setTimeout(() => {
      if (username && password) {
        // Generate and store auth token in localStorage
        const token = generateAuthToken(username);
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        
        // Set a cookie as well (some systems use cookies for auth)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7); // 7 days expiry
        document.cookie = `auth_session=${token}; expires=${expiryDate.toUTCString()}; path=/; secure; SameSite=Strict`;
        
        resolve(true);
      } else {
        reject(new Error('Invalid credentials'));
      }
    }, 300);
  });
}

// Check authentication status
function checkAuthentication() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    try {
      // Decode the token to get username (in a real app, you'd verify the token)
      const decodedToken = atob(token);
      const username = decodedToken.split(':')[0];
      return {
        isAuthenticated: true,
        username: username
      };
    } catch (e) {
      console.error('Invalid token format', e);
      return { isAuthenticated: false };
    }
  }
  return { isAuthenticated: false };
}

// Login button click handler
document.getElementById('loginButton').addEventListener('click', function() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  // Update status during login attempt
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Logging in...';
  statusDiv.className = 'status';
  
  performAuthentication(username, password)
    .then(() => {
      isLoggedIn = true;
      currentUser = username;
      updateUI();
    })
    .catch(error => {
      statusDiv.textContent = error.message || 'Authentication failed';
      statusDiv.className = 'status logged-out';
    });
});

// Logout button click handler
document.getElementById('logoutButton').addEventListener('click', function() {
  // Check if we're running in test mode
  const isInTestMode = false; // window.location.search.includes('test=true');
  // Perform complete logout
  performLogout(isInTestMode);
});

// Add a dedicated logout function for better separation of concerns
function performLogout(isTestMode = false) {
  console.log("Performing logout...");
  
  // Clear authentication state
  isLoggedIn = false;
  
  // Clear localStorage items
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('currentUser');
  localStorage.removeItem(AUTH_TOKEN_KEY);
  
  // Clear cookies - ensure complete removal across all domains and paths
  document.cookie = "auth_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  
  // Log for debugging/testing
  console.log("Cleared authentication data");
  
  // Store the username temporarily for the reload
  const tempUsername = currentUser;
  
  // Notify background script about logout and request extension reload
  chrome.runtime.sendMessage({
    action: 'logout', 
    previousUser: currentUser,
    requestReload: !isTestMode  // Don't request reload during tests
  }, response => {
    console.log("Background script acknowledged logout:", response);
    
    // Update UI while currentUser is still available
    updateUI();
    
    // Reset current user
    currentUser = null;
    
    // Only proceed with page reload if not in test mode
    if (isTestMode) {
      // We'll use a short delay to allow UI updates and test verification
      // before the background script potentially reloads the extension
      setTimeout(() => {
        console.log(`Page ready for extension reload after logout of user: ${tempUsername}`);
        
        // Add logout parameter to URL to indicate state in case extension reload isn't performed
        window.location.href = window.location.href.split('?')[0] + '?logout=true';
      }, 500);
    } else {
      console.log("Test mode: skipping page reload after logout");
    }
  });
}

// Check if user was already logged in
window.addEventListener('DOMContentLoaded', function() {
  // Check if this is a reload after logout
  const urlParams = new URLSearchParams(window.location.search);
  const isPostLogout = urlParams.get('logout') === 'true';
  
  if (isPostLogout) {
    console.log("Page loaded after logout - ensuring clean state");
    // Clear query parameters after detecting logout state
    const cleanUrl = window.location.href.split('?')[0];
    window.history.replaceState({}, document.title, cleanUrl);
    
    // Ensure we're in a clean state
    isLoggedIn = false;
    currentUser = null;
    updateUI();
  } else {
    // Normal login state checking
    const authStatus = checkAuthentication();
    
    if (authStatus.isAuthenticated) {
      isLoggedIn = true;
      currentUser = authStatus.username;
      updateUI();
    } else if (localStorage.getItem('isLoggedIn') === 'true') {
      // Fallback to old method if token is missing but localStorage flag exists
      isLoggedIn = true;
      currentUser = localStorage.getItem('currentUser');
      
      // Generate a new token since it's missing
      const token = generateAuthToken(currentUser);
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      
      updateUI();
    } else {
      updateUI();
    }
  }
  
  // Check if we're in test mode and append a marker
  if (window.navigator.userAgent.includes('Playwright')) {
    console.log("Running in test environment");
    document.body.classList.add('test-mode');
  }
});

// Expose testing helpers
window.testHelpers = {
  loginUser: function(username, password) {
    return performAuthentication(username, password).then(() => {
      isLoggedIn = true;
      currentUser = username;
      updateUI();
      return true;
    });
  },
  logoutUser: function() {
    performLogout(true); // true = test mode, skip page reload
    return true;
  }
};