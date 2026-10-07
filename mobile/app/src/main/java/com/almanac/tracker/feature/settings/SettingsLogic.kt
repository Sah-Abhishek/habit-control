package com.almanac.tracker.feature.settings

import com.almanac.tracker.core.model.MeResponse

/** New accounts (and anyone who skipped the server flag) see onboarding once. */
fun shouldShowOnboarding(me: MeResponse?): Boolean = me != null && !me.settings.onboarded

const val MAX_TARGET_MINUTES = 24 * 60

/** Parses hours + minutes fields into total minutes, or an error message. */
fun parseTargetMinutes(hours: String, minutes: String): Result<Int> {
    val h = hours.trim().ifEmpty { "0" }.toIntOrNull()
    val m = minutes.trim().ifEmpty { "0" }.toIntOrNull()
    if (h == null || m == null || h < 0 || m < 0) return Result.failure(IllegalArgumentException("Use whole numbers of 0 or more."))
    if (m >= 60) return Result.failure(IllegalArgumentException("Minutes must be under 60."))
    val total = h * 60 + m
    if (total > MAX_TARGET_MINUTES) return Result.failure(IllegalArgumentException("That’s more than a day."))
    return Result.success(total)
}

/** Revision intervals must be 1..365 days, strictly increasing, 1..10 of them. */
fun validateIntervals(intervals: List<Int>): String? = when {
    intervals.isEmpty() -> "Add at least one interval."
    intervals.size > 10 -> "Use at most 10 intervals."
    intervals.any { it !in 1..365 } -> "Each interval must be between 1 and 365 days."
    intervals.zipWithNext().any { (a, b) -> b <= a } -> "Intervals must increase (e.g. 1, 3, 7, 21, 45)."
    else -> null
}

/** "1, 3, 7" → [1, 3, 7]; null if any piece isn't a number. */
fun parseIntervals(text: String): List<Int>? {
    val parts = text.split(',', ' ', ';').map { it.trim() }.filter { it.isNotEmpty() }
    val nums = parts.map { it.toIntOrNull() ?: return null }
    return nums
}
