# Playwright Regression - Failure to capture console-logs from a 3rd-party 

## Reproduction Steps

1. Run `pip install -r requirements.txt && playwright install chromium`
2. Add a breakpoint in Line 42 of in `tests/test_extension_console_log.py`.
3. Run the `test_extension_console_log` in debug mode.
4. When reaching the breakpoint: \
In the browser's dev-tools, go to the console and see that the log `"Test console log from a third-party execution context"` appears.
5. Continue the test run - `playwright` doesn't catch the aforementioned log and the test fails.
