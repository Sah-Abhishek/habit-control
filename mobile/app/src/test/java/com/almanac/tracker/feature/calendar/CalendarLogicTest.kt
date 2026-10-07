package com.almanac.tracker.feature.calendar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth
import java.util.Locale

class CalendarLogicTest {
    private val oct2026 = YearMonth.of(2026, 10) // 1 Oct 2026 is a Thursday

    @Test fun mondayStartHasThreeLeadingBlanks() {
        val grid = buildMonthGrid(oct2026, weekStartsOn = 1)
        assertEquals(listOf(null, null, null), grid[0].take(3))
        assertEquals(LocalDate.of(2026, 10, 1), grid[0][3])
        grid.forEach { assertEquals(7, it.size) }
        assertEquals(31, grid.flatten().count { it != null })
    }

    @Test fun sundayStartHasFourLeadingBlanks() {
        val grid = buildMonthGrid(oct2026, weekStartsOn = 0)
        assertEquals(4, grid[0].takeWhile { it == null }.size)
    }

    @Test fun monthStartingOnWeekStartHasNoBlanks() {
        // 1 Feb 2026 is a Sunday.
        val grid = buildMonthGrid(YearMonth.of(2026, 2), weekStartsOn = 0)
        assertEquals(LocalDate.of(2026, 2, 1), grid[0][0])
        assertEquals(4, grid.size) // 28 days, exactly four weeks
    }

    @Test fun headersFollowWeekStart() {
        assertEquals(listOf("M", "T", "W", "T", "F", "S", "S"), weekdayHeaders(1, Locale.ENGLISH))
        assertEquals("S", weekdayHeaders(0, Locale.ENGLISH).first())
    }

    @Test fun parsesMonthsDefensively() {
        assertEquals(oct2026, parseMonth("2026-10"))
        assertNull(parseMonth("2026-13"))
        assertNull(parseMonth("nonsense"))
        assertNull(parseMonth(null))
    }
}
