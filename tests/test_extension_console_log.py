import logging

from playwright.sync_api import sync_playwright, ConsoleMessage
import pytest


@pytest.fixture(scope="session", name="logger")
def get_logger() -> logging.Logger:
    return logging.getLogger(__name__)


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
