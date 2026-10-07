package com.almanac.tracker.navigation

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

// Tabs
@Serializable data object TodayKey : NavKey
@Serializable data object PlanKey : NavKey
@Serializable data object HabitsKey : NavKey
@Serializable data object InsightsKey : NavKey

// Detail screens
@Serializable data class HabitDetailKey(val id: String) : NavKey
@Serializable data class GoalDetailKey(val id: String) : NavKey
@Serializable data class SubjectKey(val id: String) : NavKey
@Serializable data object TasksKey : NavKey
/** The running focus-session timer. */
@Serializable data object SessionKey : NavKey
@Serializable data class WrapUpKey(val sessionId: String, val longSession: Boolean = false) : NavKey
@Serializable data class CalendarKey(val month: String? = null) : NavKey
@Serializable data class DayKey(val date: String) : NavKey
@Serializable data class WeeklyReviewKey(val week: String? = null) : NavKey
@Serializable data object SettingsKey : NavKey
@Serializable data object OnboardingKey : NavKey

val TabKeys: List<NavKey> = listOf(TodayKey, PlanKey, HabitsKey, InsightsKey)

/** What feature screens can ask the shell to do. */
interface Navigator {
    fun go(key: NavKey)
    fun back()
    /** Clears the stack and shows a tab. */
    fun tab(key: NavKey)
    /** Replaces the current screen (e.g. timer → wrap-up). */
    fun replace(key: NavKey)
    fun openQuickLog()
}

val LocalNavigator = staticCompositionLocalOf<Navigator> { error("Navigator not provided") }
