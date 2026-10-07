package com.almanac.tracker.feature.calendar

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

/** 0 = Sunday … 6 = Saturday (the API's convention). */
fun DayOfWeek.toApiIndex(): Int = value % 7

/** "2026-10" → YearMonth, null when malformed or absurd. */
fun parseMonth(raw: String?): YearMonth? = raw?.let {
    runCatching { YearMonth.parse(it) }.getOrNull()?.takeIf { m -> m.year in 1970..2200 }
}

/**
 * Month grid as rows of 7 cells; leading/trailing cells outside the month are null.
 * [weekStartsOn] uses 0 = Sunday … 6 = Saturday.
 */
fun buildMonthGrid(month: YearMonth, weekStartsOn: Int): List<List<LocalDate?>> {
    val start = weekStartsOn.coerceIn(0, 6)
    val first = month.atDay(1)
    val leading = (first.dayOfWeek.toApiIndex() - start + 7) % 7
    val cells = ArrayList<LocalDate?>()
    repeat(leading) { cells.add(null) }
    for (d in 1..month.lengthOfMonth()) cells.add(month.atDay(d))
    while (cells.size % 7 != 0) cells.add(null)
    return cells.chunked(7)
}

/** Narrow weekday headers ordered from the week start, e.g. M T W T F S S. */
fun weekdayHeaders(weekStartsOn: Int, locale: Locale = Locale.getDefault()): List<String> =
    (0..6).map { i ->
        val apiIndex = (weekStartsOn.coerceIn(0, 6) + i) % 7
        val dow = if (apiIndex == 0) DayOfWeek.SUNDAY else DayOfWeek.of(apiIndex)
        dow.getDisplayName(TextStyle.NARROW, locale)
    }

fun weekdayFullName(date: LocalDate, locale: Locale = Locale.getDefault()): String = date.dayOfWeek.getDisplayName(TextStyle.FULL, locale)
