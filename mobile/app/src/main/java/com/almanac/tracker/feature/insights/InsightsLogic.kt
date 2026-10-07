package com.almanac.tracker.feature.insights

import kotlin.math.ceil
import kotlin.math.roundToInt

enum class InsightRange(val key: String, val label: String, val long: String) {
    Week("7d", "7d", "last 7 days"),
    Month("30d", "30d", "last 30 days"),
    Quarter("90d", "90d", "last 90 days"),
    Year("1y", "1y", "last 12 months");

    companion object {
        fun fromKey(key: String?): InsightRange = entries.firstOrNull { it.key == key } ?: Month
    }
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

fun formatHours(seconds: Long): String {
    val h = seconds / 3600.0
    return if (h >= 10) "${h.roundToInt()}h" else "${(h * 10).roundToInt() / 10.0}h".replace(".0h", "h")
}

fun formatPercent(ratio: Double?): String = ratio?.takeIf { it.isFinite() }?.let { "${(it * 100).roundToInt()}%" } ?: "—"

fun formatOne(v: Double?): String = v?.takeIf { it.isFinite() }?.let {
    val r = (it * 10).roundToInt() / 10.0
    if (r % 1.0 == 0.0) r.toLong().toString() else r.toString()
} ?: "—"

/**
 * Upper bound for a chart axis: covers every value and the target with ~10% headroom,
 * rounded up to a readable step. Never returns 0 (avoids division by zero).
 */
fun niceMax(values: List<Double>, target: Double? = null): Double {
    val raw = (values + listOfNotNull(target)).filter { it.isFinite() }.maxOrNull() ?: 0.0
    if (raw <= 0) return 1.0
    val padded = raw * 1.1
    val step = when {
        padded <= 1 -> 0.25
        padded <= 5 -> 1.0
        padded <= 20 -> 5.0
        padded <= 100 -> 10.0
        else -> 50.0
    }
    return ceil(padded / step) * step
}

/** Fraction (0..1) of a chart's height that [value] occupies. */
fun scale(value: Double, max: Double): Float = if (max <= 0 || !value.isFinite()) 0f else (value / max).coerceIn(0.0, 1.0).toFloat()
