package com.almanac.tracker.feature.study

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

/** Pure study helpers — no Android, unit tested. */
object StudyMath {
    /** Length of one focus block on the timer ring, matching the designs. */
    const val BLOCK_SECONDS = 50 * 60

    /** Sessions longer than this get a "did the timer keep running?" prompt. */
    const val LONG_SESSION_SECONDS = 3 * 60 * 60

    /** Server cap for a single session. */
    const val MAX_SESSION_MINUTES = 16 * 60

    val FOCUS_LABELS = listOf("Poor", "Low", "Okay", "Good", "Deep")

    val METHODS = listOf(
        "lecture" to "Lecture",
        "reading" to "Reading",
        "notes" to "Notes",
        "practice" to "Practice",
        "problem_solving" to "Problem solving",
        "revision" to "Revision",
        "mock_test" to "Mock test",
        "project_work" to "Project work",
    )

    fun methodLabel(method: String?): String? = METHODS.firstOrNull { it.first == method }?.second

    /** 1..5 → label; anything else → null. */
    fun focusLabel(focus: Int?): String? = focus?.takeIf { it in 1..5 }?.let { FOCUS_LABELS[it - 1] }

    /**
     * Elapsed seconds to display now. [baseElapsed] is the server-computed value when the
     * response arrived; [anchorMs] the monotonic clock at that moment. A paused session
     * does not advance.
     */
    fun elapsedNow(baseElapsed: Long, anchorMs: Long, nowMs: Long, paused: Boolean): Long {
        if (paused) return baseElapsed.coerceAtLeast(0)
        val delta = ((nowMs - anchorMs).coerceAtLeast(0)) / 1000
        return (baseElapsed + delta).coerceAtLeast(0)
    }

    /** Index of the current 50-minute block (1-based) and progress inside it (0..1). */
    fun block(elapsed: Long): Pair<Int, Float> {
        val e = elapsed.coerceAtLeast(0)
        val index = (e / BLOCK_SECONDS).toInt() + 1
        val progress = (e % BLOCK_SECONDS).toFloat() / BLOCK_SECONDS
        return index to progress
    }

    /** correct / attempted, or null when nothing was attempted. */
    fun accuracy(attempted: Int?, correct: Int?): Double? {
        if (attempted == null || correct == null || attempted <= 0) return null
        return correct.coerceIn(0, attempted).toDouble() / attempted
    }

    fun percent(ratio: Double?): String = ratio?.let { "${(it * 100).roundToInt()}%" } ?: "—"

    /** "2h 15m", "45m", "0m". */
    fun formatDuration(seconds: Long): String {
        val s = seconds.coerceAtLeast(0)
        val h = s / 3600
        val m = (s % 3600) / 60
        return when {
            h == 0L -> "${m}m"
            m == 0L -> "${h}h"
            else -> "${h}h ${m}m"
        }
    }

    /** "38:12" or "1:02:05". */
    fun formatTimer(seconds: Long): String {
        val s = seconds.coerceAtLeast(0)
        val h = s / 3600
        val m = (s % 3600) / 60
        val sec = s % 60
        return if (h > 0) "%d:%02d:%02d".format(h, m, sec) else "%d:%02d".format(m, sec)
    }

    /** "HH:mm" → minutes since midnight, or null. */
    fun parseClock(value: String): Int? {
        val m = Regex("^(\\d{1,2}):(\\d{2})$").matchEntire(value.trim()) ?: return null
        val h = m.groupValues[1].toInt()
        val min = m.groupValues[2].toInt()
        if (h !in 0..23 || min !in 0..59) return null
        return h * 60 + min
    }

    /** Minutes between start and end; an end before the start means the session crossed midnight. */
    fun spanMinutes(start: Int, end: Int): Int = if (end >= start) end - start else end + 24 * 60 - start

    /**
     * Validates an edited time range. Returns field → message (empty = valid). Mirrors
     * the server rules so the user sees problems before a round trip.
     */
    fun validateTimes(date: String, startTime: String, endTime: String, today: LocalDate): Map<String, String> = buildMap {
        val d = runCatching { LocalDate.parse(date) }.getOrNull()
        if (d == null) put("date", "Use a YYYY-MM-DD date")
        else if (d.isAfter(today)) put("date", "That day hasn’t happened yet")
        val s = parseClock(startTime)
        val e = parseClock(endTime)
        if (s == null) put("startTime", "Use 24-hour time, e.g. 07:45")
        if (e == null) put("endTime", "Use 24-hour time, e.g. 08:37")
        if (s != null && e != null) {
            val span = spanMinutes(s, e)
            if (span == 0) put("endTime", "End must be after the start")
            else if (span > MAX_SESSION_MINUTES) put("endTime", "A session can be at most 16 hours")
        }
    }

    /** Validates questions answered; correct can't exceed attempted. */
    fun validateQuestions(attempted: String, correct: String): Map<String, String> = buildMap {
        val a = attempted.trim().takeIf { it.isNotEmpty() }?.toIntOrNull()
        val c = correct.trim().takeIf { it.isNotEmpty() }?.toIntOrNull()
        if (attempted.isNotBlank() && (a == null || a < 0)) put("questionsAttempted", "Enter a whole number")
        if (correct.isNotBlank() && (c == null || c < 0)) put("questionsCorrect", "Enter a whole number")
        if (a != null && c != null && c > a) put("questionsCorrect", "Can’t be more than attempted ($a)")
        if (a == null && c != null && attempted.isBlank()) put("questionsAttempted", "Add how many you attempted")
    }

    /** Local "HH:mm" of an ISO instant in [zone]; null if unparsable. */
    fun clockOf(iso: String?, zone: ZoneId): String? = iso?.let {
        runCatching { DateTimeFormatter.ofPattern("HH:mm").format(Instant.parse(it).atZone(zone)) }.getOrNull()
    }

    /** Local date of an ISO instant in [zone]. */
    fun dateOf(iso: String?, zone: ZoneId): String? = iso?.let {
        runCatching { Instant.parse(it).atZone(zone).toLocalDate().toString() }.getOrNull()
    }

    fun zoneOf(id: String?): ZoneId = id?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()

    enum class RevState { Done, Skipped, Due, Upcoming }

    fun revisionState(dueDate: String, completedAt: String?, skippedAt: String?, today: LocalDate): RevState = when {
        completedAt != null -> RevState.Done
        skippedAt != null -> RevState.Skipped
        runCatching { !LocalDate.parse(dueDate).isAfter(today) }.getOrDefault(false) -> RevState.Due
        else -> RevState.Upcoming
    }

    /** "Today", "3d late", "in 4d". */
    fun relativeDue(dueDate: String, today: LocalDate): String {
        val d = runCatching { LocalDate.parse(dueDate) }.getOrNull() ?: return dueDate
        val diff = java.time.temporal.ChronoUnit.DAYS.between(today, d)
        return when {
            diff == 0L -> "today"
            diff < 0 -> "${-diff}d late"
            else -> "in ${diff}d"
        }
    }
}
