package com.almanac.tracker.feature.settings

import com.almanac.tracker.core.model.MeResponse
import com.almanac.tracker.core.model.SettingsDto
import com.almanac.tracker.core.model.UserDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SettingsLogicTest {
    @Test fun intervalsMustIncreaseWithinBounds() {
        assertNull(validateIntervals(listOf(1, 3, 7, 21, 45)))
        assertNotNull(validateIntervals(emptyList()))
        assertNotNull(validateIntervals(listOf(3, 3)))
        assertNotNull(validateIntervals(listOf(7, 3)))
        assertNotNull(validateIntervals(listOf(0, 3)))
        assertNotNull(validateIntervals(listOf(1, 400)))
        assertNotNull(validateIntervals((1..11).toList()))
    }

    @Test fun parsesIntervalText() {
        assertEquals(listOf(1, 3, 7), parseIntervals("1, 3, 7"))
        assertEquals(listOf(1, 3), parseIntervals(" 1 3 "))
        assertNull(parseIntervals("1, x"))
    }

    @Test fun targetMinutesValidation() {
        assertEquals(130, parseTargetMinutes("2", "10").getOrThrow())
        assertEquals(0, parseTargetMinutes("", "").getOrThrow())
        assertTrue(parseTargetMinutes("24", "1").isFailure)
        assertTrue(parseTargetMinutes("1", "60").isFailure)
        assertTrue(parseTargetMinutes("-1", "0").isFailure)
        assertTrue(parseTargetMinutes("a", "0").isFailure)
    }

    @Test fun onboardingOnlyForNotOnboarded() {
        val user = UserDto("u", "a@b.c", "A")
        assertFalse(shouldShowOnboarding(null))
        assertTrue(shouldShowOnboarding(MeResponse(user, "2026-10-07", SettingsDto(onboarded = false))))
        assertFalse(shouldShowOnboarding(MeResponse(user, "2026-10-07", SettingsDto(onboarded = true))))
    }
}
