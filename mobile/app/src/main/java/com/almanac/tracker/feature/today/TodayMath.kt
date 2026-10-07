package com.almanac.tracker.feature.today

import kotlin.math.roundToInt

/** Pure helpers for Today: dial geometry, durations, greetings, sleep times. Unit tested. */
object TodayMath {
    /** Canvas angle (degrees, 0 = 3 o'clock, clockwise) for an hour of day with midnight at the top. */
    fun angleForHour(hour: Double): Float = ((hour / 24.0) * 360.0 - 90.0).toFloat()

    /** Sweep in degrees from [start] to [end] hours, wrapping past midnight. */
    fun sweep(start: Double, end: Double): Float {
        var e = end
        if (e < start) e += 24.0
        return (((e - start) / 24.0) * 360.0).toFloat().coerceIn(0f, 360f)
    }

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

    /** "2:15" compact hours:minutes. */
    fun formatClock(seconds: Long): String {
        val s = seconds.coerceAtLeast(0)
        return "${s / 3600}:${"%02d".format((s % 3600) / 60)}"
    }

    /** Running-timer format "38:12" or "1:02:05". */
    fun formatTimer(seconds: Long): String {
        val s = seconds.coerceAtLeast(0)
        val h = s / 3600
        val m = (s % 3600) / 60
        val sec = s % 60
        return if (h > 0) "$h:${"%02d".format(m)}:${"%02d".format(sec)}" else "$m:${"%02d".format(sec)}"
    }

    fun greeting(part: String): String = when (part) {
        "afternoon" -> "Good afternoon."
        "evening" -> "Good evening."
        else -> "Good morning."
    }

    /** Minutes since midnight for "HH:mm" (24h), or null if malformed. */
    fun parseClock(value: String): Int? {
        val m = Regex("^(\\d{1,2}):(\\d{2})$").matchEntire(value.trim()) ?: return null
        val h = m.groupValues[1].toInt()
        val min = m.groupValues[2].toInt()
        if (h !in 0..23 || min !in 0..59) return null
        return h * 60 + min
    }

    fun formatClockTime(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)

    /**
     * Sleep length in minutes between bed and wake. A bed time later on the clock than
     * the wake time means the evening before (crossing midnight). Returns null with a
     * reason via [validateSleep] when the window is impossible.
     */
    fun sleepMinutes(bed: Int, wake: Int): Int = ((wake - bed) + 1440) % 1440

    /** Error message for an invalid window, or null when valid (same rules as the web). */
    fun validateSleep(bed: String, wake: String): String? {
        val b = parseClock(bed) ?: return "Use a time like 23:30"
        val w = parseClock(wake) ?: return "Use a time like 07:00"
        val minutes = sleepMinutes(b, w)
        if (minutes == 0) return "Bed and wake time can’t be the same"
        if (minutes > 16 * 60) return "That’s more than 16 hours — check the times"
        return null
    }

    fun formatHours(minutes: Int): String = formatDuration(minutes * 60L)

    /**
     * Share of today's plan done: the mean of the parts that apply (study vs target,
     * habits on track, tasks done). Null when nothing is planned.
     */
    fun planProgress(studySeconds: Long, targetSeconds: Long, habitsDone: Int, habitsScheduled: Int, tasksDone: Int, tasksTotal: Int): Double? {
        val parts = buildList {
            if (targetSeconds > 0) add((studySeconds.toDouble() / targetSeconds).coerceIn(0.0, 1.0))
            if (habitsScheduled > 0) add(habitsDone.toDouble() / habitsScheduled)
            if (tasksTotal > 0) add(tasksDone.toDouble() / tasksTotal)
        }
        return if (parts.isEmpty()) null else parts.average()
    }

    fun percent(ratio: Double): String = "${(ratio * 100).roundToInt()}%"
}
