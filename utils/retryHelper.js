/**
 * retryHelper.js
 *
 * Provides a generic retry utility for Playwright automations where UI interactions
 * may not succeed on the first attempt due to animations, lazy loading, or timing issues.
 */

/**
 * Retries an action until a success condition is met or the retry limit is reached.
 *
 * @param {object} options
 * @param {() => Promise<void>} options.action       - The async action to attempt (e.g. clicking a button).
 * @param {() => Promise<boolean>} options.successCheck - Async function that returns true when the action succeeded.
 * @param {number} [options.retries=8]               - Maximum number of attempts before throwing.
 * @param {number} [options.delay=500]               - Milliseconds to wait between failed attempts.
 * @param {string} [options.name='action']           - Descriptive label used in error/log messages.
 * @returns {Promise<true>}                          - Resolves with true on success.
 * @throws {Error}                                   - Throws if all retry attempts are exhausted.
 *
 * @example
 * await retryAction({
 *   action: async () => { await dropdownTrigger.click(); },
 *   successCheck: async () => { return await attachBtn.isVisible(); },
 *   retries: 10,
 *   delay: 300,
 *   name: 'open attachment dropdown',
 * });
 */
export async function retryAction({
  action,
  successCheck,
  retries = 15,
  delay = 2000,
  name = 'action'
}) {
  for (let i = 0; i < retries; i++) {
    try {
      // Perform the action (e.g. a click)
      await action();

      // Check whether the action had its intended effect
      const success = await successCheck();

      if (success) {
        return true; // Action succeeded — stop retrying
      }

    } catch (err) {
      // Log the failed attempt but continue retrying
      console.log(`Attempt ${i + 1} failed for ${name}`);
    }

    // Wait before the next attempt (skip delay after the last attempt)
    if (i < retries - 1) {
      await new Promise(res => setTimeout(res, delay));
    }
  }

  // All attempts exhausted — surface a clear error
  throw new Error(`Failed after ${retries} attempts: ${name}`);
}
