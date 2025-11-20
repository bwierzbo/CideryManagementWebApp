/**
 * Cellar operation constants
 */

/**
 * Minimum working volume threshold for cellar operations
 * Volumes below this threshold are considered residual waste
 * and trigger auto-empty to prevent "ghost liquid" issues
 *
 * When a transfer or packaging operation would leave less than
 * this amount remaining, the residual is automatically emptied,
 * added to the operation's loss, and the vessel is set to cleaning status.
 */
export const MIN_WORKING_VOLUME_L = 1.0;

/**
 * Tolerance for volume comparisons (0.1L = 100ml)
 * Used to account for measurement and rounding errors
 */
export const VOLUME_TOLERANCE_L = 0.1;
