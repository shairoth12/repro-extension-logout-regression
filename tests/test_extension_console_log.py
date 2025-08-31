import logging
import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, ConsoleMessage, expect
import pytest


@pytest.fixture(scope="session", name="logger")
def get_logger() -> logging.Logger:
    return logging.getLogger(__name__)


def test_extension_login_logout(logger: logging.Logger):
    path_to_extension = str(Path("./extension").absolute())
    user_data_dir = str(Path("./user-data").absolute())
    
    # Ensure user data directory exists
    os.makedirs(user_data_dir, exist_ok=True)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,
            args=[
                f"--disable-extensions-except={path_to_extension}",
                f"--load-extension={path_to_extension}",
            ],
            devtools=True,
        )

        # Find the extension ID
        extension_url = None
        extension_id = None
        for background_page in context.background_pages:
            if 'chrome-extension://' in background_page.url:
                extension_id = background_page.url.split('/')[2]
                extension_url = f"chrome-extension://{extension_id}/login.html?test=true"  # Add test flag
                logger.info(f"Extension ID: {extension_id}")
                break

        if not extension_url:
            for service_worker in context.service_workers:
                if 'chrome-extension://' in service_worker.url:
                    extension_id = service_worker.url.split('/')[2]
                    extension_url = f"chrome-extension://{extension_id}/login.html?test=true"  # Add test flag
                    logger.info(f"Extension ID: {extension_id}")
                    break

        assert extension_url, "Could not find extension URL"

        # Open the extension's login page
        page = context.new_page()
        
        # Listen for console messages
        console_logs = []

        def handle_console_message(msg: ConsoleMessage):
            console_logs.append(msg.text)
            logger.info(f"Console: {msg.text}")

        page.on("console", handle_console_message)
        
        # Navigate to the login page with test mode
        logger.info(f"Navigating to: {extension_url}")
        page.goto(extension_url)
        
        # Verify the login page loaded
        expect(page.locator('h2')).to_contain_text("Extension Authentication")
        
        # Inform background script that we're in test mode
        # try:
        #     page.evaluate("""() => {
        #         chrome.runtime.sendMessage({action: 'setTestMode'}, (response) => {
        #             console.log('Set test mode response:', response);
        #         });
        #     }""")
        #     logger.info("Set test mode in background script")
        # except Exception as e:
        #     logger.warning(f"Could not set test mode: {e}")
        
        # 1. Perform login
        page.fill("#username", "testuser")
        page.fill("#password", "password123")
        page.click("#loginButton")
        
        # Wait for login to complete
        page.wait_for_selector('#logoutForm:visible')
        
        # Verify logged in status in UI
        expect(page.locator('#userDisplay')).to_contain_text("testuser")
        expect(page.locator('#status')).to_contain_text("Successfully logged in")
        
        # Check for login console message
        page.wait_for_timeout(1000)  # Give time for console logs
        
        login_message_found = any("User testuser logged in successfully" in log for log in console_logs)
        assert login_message_found, "Login message not found in console logs"
        
        # Now perform the logout - using test mode to prevent actual extension reload
        logger.info("Performing logout")
        page.click("#logoutButton")
        
        # Wait for logout to complete - increased timeout to handle longer operations
        page.wait_for_selector('#loginForm:visible', timeout=10000)
        
        # Wait to capture logout messages - this is crucial
        page.wait_for_timeout(2000)
        
        # Verify logged out status
        expect(page.locator('#status')).to_contain_text("User testuser logged out")
        
        # Check for logout console messages
        logout_message_found = any("User testuser logged out" in log for log in console_logs)
        assert logout_message_found, "Logout message not found in console logs"
        
        cleared_data_message = any("Cleared authentication data" in log for log in console_logs)
        assert cleared_data_message, "Authentication data clearing message not found"
        
        # 3. Check access to extension page after logout
        # We need to reopen the page since it might have been redirected
        logger.info(f"Navigating again to: {extension_url}")
        page.goto(extension_url)
        
        # Give some time for page to load
        page.wait_for_timeout(1000)
        
        # Verify login form is displayed (user remains logged out)
        expect(page.locator('#loginForm')).to_be_visible()
        
        # Close browser
        context.close()


def test_extension_console_log(logger: logging.Logger):
    path_to_extension = "./extension"

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="",
            headless=False,
            args=[
                f"--disable-extensions-except={path_to_extension}",
                f"--load-extension={path_to_extension}",
            ],
            devtools=True,
        )

        page = context.new_page()

        # Listen for console messages
        console_logs = []

        def handle_console_message(msg: ConsoleMessage):
            console_logs.append(msg.text)
            logger.info(f"Handle console message: {msg.text}")

        page.on("console", handle_console_message)

        page.goto("https://example.com")

        # Wait for logs (just in case)
        page.wait_for_timeout(2000)

        context.close()

        # Assert that we captured the extension log
        assert (
            "Test console log from a third-party execution context" in console_logs
        ), "Expected log not found in captured console logs"