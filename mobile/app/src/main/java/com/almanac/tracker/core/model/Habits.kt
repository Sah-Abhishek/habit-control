package com.almanac.tracker.core.model

import kotlinx.serialization.Serializable

/** Mirrors docs/api.md → Habits. */
@Serializable
data class Tick(val date: String, val state: String, val value: Double = 0.0)

@Serializable
data class ConsistencyDto(val successes: Int = 0, val scheduled: Int = 0, val rate: Double? = null)

@Serializable
data class ConsistencySet(val d7: ConsistencyDto = ConsistencyDto(), val d30: ConsistencyDto = ConsistencyDto(), val d90: ConsistencyDto = ConsistencyDto())

@Serializable
data class StreakDto(val current: Int = 0, val best: Int = 0)

@Serializable
data class HabitToday(val value: Double = 0.0, val state: String = "pending", val scheduled: Boolean = true)

@Serializable
data class ReductionDto(
    val weekAvg: Double? = null,
    val prevWeekAvg: Double? = null,
    val monthAvg: Double? = null,
    val prevMonthAvg: Double? = null,
    val weekChange: Double? = null,
    val daysSinceLast: Int? = null,
    val longestClearRun: Int = 0,
    val clearDaysLast30: Int = 0,
    val avoidedVsBaseline: Int? = null,
    val todayValue: Double = 0.0,
)

@Serializable
data class HabitSummary(
    val id: String,
    val name: String,
    val kind: String, // build | reduce
    val tracking: String, // binary | quantity | duration | numeric
    val target: Double,
    val unit: String? = null,
    val scheduleDays: List<Int> = listOf(0, 1, 2, 3, 4, 5, 6),
    val baseline: Double? = null,
    val isSensitive: Boolean = false,
    val goalId: String? = null,
    val startedOn: String = "",
    val archived: Boolean = false,
    val today: HabitToday = HabitToday(),
    val consistency: ConsistencySet = ConsistencySet(),
    val streak: StreakDto = StreakDto(),
    val trail7: List<Tick> = emptyList(),
    val reduction: ReductionDto? = null,
) {
    val isReduce get() = kind == "reduce"
    val isBinary get() = kind == "build" && tracking == "binary"
}

@Serializable
data class ArchivedHabit(val id: String, val name: String, val kind: String)

@Serializable
data class HabitsResponse(val today: String, val habits: List<HabitSummary>, val archived: List<ArchivedHabit> = emptyList())

@Serializable
data class WeeklyAverage(val weekEnd: String, val avg: Double? = null)

@Serializable
data class HabitDetailResponse(
    val habit: HabitSummary,
    val thread90: List<Tick> = emptyList(),
    val weeklyAverages: List<WeeklyAverage> = emptyList(),
    val recentDays: List<Tick> = emptyList(),
)

@Serializable
data class HabitInput(
    val name: String,
    val kind: String,
    val tracking: String,
    val target: Double,
    val unit: String? = null,
    val scheduleDays: List<Int>,
    val baseline: Double? = null,
    val isSensitive: Boolean,
    val goalId: String? = null,
)

@Serializable
data class LogValueBody(val value: Double)

@Serializable
data class LogResult(val value: Double, val previous: Double)

@Serializable
data class ArchivedBody(val archived: Boolean)
