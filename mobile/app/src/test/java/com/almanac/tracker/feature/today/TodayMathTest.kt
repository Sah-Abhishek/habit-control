package com.almanac.tracker.feature.today

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test

class TodayMathTest {
    @Test fun midnightIsAtTheTop() {
        assertEquals(-90f, TodayMath.angleForHour(0.0), 0.001f)
        assertEquals(0f, TodayMath.angleForHour(6.0), 0.001f)
        assertEquals(90f, TodayMath.angleForHour(12.0), 0.001f)
        assertEquals(180f, TodayMath.angleForHour(18.0), 0.001f)
    }

    @Test fun sweepWrapsPastMidnight() {
        assertEquals(90f, TodayMath.sweep(0.0, 6.0), 0.001f)
        assertEquals(30f, TodayMath.sweep(23.0, 1.0), 0.001f)
        assertEquals(0f, TodayMath.sweep(5.0, 5.0), 0.001f)
    }

    @Test fun durations() {
        assertEquals("0m", TodayMath.formatDuration(0))
        assertEquals("45m", TodayMath.formatDuration(45 * 60))
        assertEquals("2h", TodayMath.formatDuration(7200))
        assertEquals("2h 15m", TodayMath.formatDuration(8100))
        assertEquals("0m", TodayMath.formatDuration(-5))
        assertEquals("2:15", TodayMath.formatClock(8100))
        assertEquals("38:12", TodayMath.formatTimer(38 * 60 + 12))
        assertEquals("1:02:05", TodayMath.formatTimer(3725))
    }

    @Test fun greetings() {
        assertEquals("Good morning.", TodayMath.greeting("morning"))
        assertEquals("Good evening.", TodayMath.greeting("evening"))
        assertEquals("Good morning.", TodayMath.greeting("unknown"))
    }

    @Test fun parsesClockStrictly() {
        assertEquals(0, TodayMath.parseClock("00:00"))
        assertEquals(7 * 60 + 5, TodayMath.parseClock("7:05"))
        assertNull(TodayMath.parseClock("24:00"))
        assertNull(TodayMath.parseClock("12:60"))
        assertNull(TodayMath.parseClock("noon"))
    }

    @Test fun sleepCrossesMidnight() {
        assertEquals(6 * 60 + 40, TodayMath.sleepMinutes(TodayMath.parseClock("00:40")!!, TodayMath.parseClock("07:20")!!))
        assertEquals(7 * 60 + 30, TodayMath.sleepMinutes(TodayMath.parseClock("23:30")!!, TodayMath.parseClock("07:00")!!))
        assertNull(TodayMath.validateSleep("23:30", "07:00"))
        assertNotNull(TodayMath.validateSleep("07:00", "07:00"))
        assertNotNull(TodayMath.validateSleep("06:00", "23:00")) // 17h
        assertNotNull(TodayMath.validateSleep("bad", "07:00"))
    }

    @Test fun planProgressAveragesWhatApplies() {
        assertNull(TodayMath.planProgress(0, 0, 0, 0, 0, 0))
        assertEquals(0.5, TodayMath.planProgress(3600, 7200, 0, 0, 0, 0)!!, 1e-9)
        assertEquals((1.0 + 0.5 + 0.75) / 3, TodayMath.planProgress(9000, 7200, 2, 4, 3, 4)!!, 1e-9)
    }
}
