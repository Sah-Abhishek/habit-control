package com.almanac.tracker.core.model

import kotlinx.serialization.Serializable

/** Mirrors docs/api.md → Calendar, Insights & review. */
@Serializable
data class CalendarDayDto(
    val date: String,
    val score: Double? = null,
    val studySeconds: Long = 0,
    val studyTargetHit: Boolean = false,
    val habitsOnTrack: Int = 0,
    val habitsScheduled: Int = 0,
    val tasksCompleted: Int = 0,
    val reduceOver: Boolean = false,
    val future: Boolean = false,
    val beforeAccount: Boolean = false,
)

@Serializable
data class CalendarResponse(val month: String, val weekStartsOn: Int = 1, val today: String, val days: List<CalendarDayDto> = emptyList())

@Serializable
data class DayHabitDto(val id: String, val name: String, val state: String, val value: Double = 0.0)

@Serializable
data class IdTitleOnly(val id: String, val title: String)

@Serializable
data class CalendarDayDetailResponse(
    val date: String,
    val score: Double? = null,
    val studySeconds: Long = 0,
    val sessions: List<SessionDto> = emptyList(),
    val habits: List<DayHabitDto> = emptyList(),
    val tasksCompleted: List<IdTitleOnly> = emptyList(),
    val entry: DayEntryDto,
)

@Serializable
data class DaysTotal(val days: Int = 0, val total: Int = 0)

@Serializable
data class DoneDue(val done: Int = 0, val due: Int = 0)

@Serializable
data class KpisDto(
    val studySeconds: Long = 0,
    val prevStudySeconds: Long? = null,
    val avgDailySeconds: Long = 0,
    val targetSeconds: Long = 0,
    val consistency: DaysTotal = DaysTotal(),
    val avgFocus: Double? = null,
    val focusSessions: Int = 0,
    val accuracy: Double? = null,
    val attempted: Int = 0,
    val correct: Int = 0,
    val revisions: DoneDue = DoneDue(),
)

@Serializable
data class WeeklyHoursDto(val weekStart: String, val seconds: Long = 0, val partial: Boolean = false)

@Serializable
data class HabitThreadDto(val id: String, val name: String, val kind: String, val ticks: List<Tick> = emptyList(), val rate: Double? = null, val trend: String? = null)

@Serializable
data class EffortDto(val subjectId: String, val name: String, val timeShare: Double = 0.0, val weightShare: Double? = null, val underInvested: Boolean = false)

@Serializable
data class FocusHourDto(val hour: Int, val avgFocus: Double? = null, val sessions: Int = 0)

@Serializable
data class WellbeingDto(val date: String, val sleepHours: Double? = null, val mood: Double? = null, val energy: Double? = null)

@Serializable
data class InsightsResponse(
    val range: String = "30d",
    val start: String = "",
    val end: String = "",
    val kpis: KpisDto = KpisDto(),
    val weekly: List<WeeklyHoursDto> = emptyList(),
    val weeklyTargetSeconds: Long = 0,
    val habitThreads: List<HabitThreadDto> = emptyList(),
    val effort: List<EffortDto> = emptyList(),
    val focusByHour: List<FocusHourDto> = emptyList(),
    val wellbeing: List<WellbeingDto> = emptyList(),
    val observations: List<ObservationDto> = emptyList(),
)

@Serializable
data class ReviewStudyDto(val seconds: Long = 0, val targetSeconds: Long = 0, val prevSeconds: Long = 0, val changePct: Double? = null, val byDay: List<WeekDayDto> = emptyList())

@Serializable
data class ReviewConsistencyDto(val daysStudied: Int = 0, val days: Int = 7)

@Serializable
data class ReviewHabitsDto(val avgPerDay: Double? = null, val scheduledPerDay: Double? = null)

@Serializable
data class ReviewSleepDto(val avgHours: Double? = null, val changeMinutes: Double? = null)

@Serializable
data class ReviewSubjectDto(val id: String, val name: String, val seconds: Long = 0, val share: Double = 0.0)

@Serializable
data class WeeklyReviewResponse(
    val weekStart: String,
    val weekEnd: String,
    val weekNumber: Int = 0,
    val study: ReviewStudyDto = ReviewStudyDto(),
    val consistency: ReviewConsistencyDto = ReviewConsistencyDto(),
    val habits: ReviewHabitsDto = ReviewHabitsDto(),
    val sleep: ReviewSleepDto = ReviewSleepDto(),
    val mood: Double? = null,
    val energy: Double? = null,
    val subjects: List<ReviewSubjectDto> = emptyList(),
    val wentWell: List<String> = emptyList(),
    val needsAttention: List<String> = emptyList(),
    val suggestion: String? = null,
)
