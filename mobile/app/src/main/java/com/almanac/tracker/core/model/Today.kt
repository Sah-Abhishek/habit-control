package com.almanac.tracker.core.model

import kotlinx.serialization.Serializable

/** Mirrors docs/api.md → Today and Days. */
@Serializable
data class GoalDayDto(val day: Int, val total: Int)

@Serializable
data class FocusDto(val topicId: String? = null, val text: String? = null, val label: String? = null, val feeds: String? = null)

@Serializable
data class StudyProgressDto(val todaySeconds: Long = 0, val targetSeconds: Long = 0)

@Serializable
data class TimelineBlockDto(val startHour: Double, val endHour: Double, val kind: String)

@Serializable
data class WeekDayDto(val date: String, val seconds: Long = 0, val future: Boolean = false)

@Serializable
data class SleepDto(val bed: String, val wake: String, val quality: Int? = null, val hours: Double = 0.0)

@Serializable
data class CheckInDto(val mood: Int? = null, val energy: Int? = null, val stress: Int? = null, val note: String? = null, val sleep: SleepDto? = null)

@Serializable
data class ObservationDto(val text: String, val n: Int = 0, val earlySignal: Boolean = false)

@Serializable
data class TodayResponse(
    val today: String,
    val greeting: String = "morning",
    val goalDay: GoalDayDto? = null,
    val focus: FocusDto = FocusDto(),
    val study: StudyProgressDto = StudyProgressDto(),
    val timeline: List<TimelineBlockDto> = emptyList(),
    val nowHour: Double = 0.0,
    val habits: List<HabitSummary> = emptyList(),
    val tasks: List<TaskRowDto> = emptyList(),
    val revisionsDue: List<DueRevisionDto> = emptyList(),
    val goal: PrimaryGoalDto? = null,
    val week: List<WeekDayDto> = emptyList(),
    val checkIn: CheckInDto = CheckInDto(),
    val runningSession: SessionDto? = null,
    val observation: ObservationDto? = null,
)

@Serializable
data class DayFocusDto(val topicId: String? = null, val text: String? = null, val label: String? = null)

@Serializable
data class DayEntryDto(
    val date: String,
    val mood: Int? = null,
    val energy: Int? = null,
    val stress: Int? = null,
    val note: String? = null,
    val sleep: SleepDto? = null,
    val focus: DayFocusDto = DayFocusDto(),
)

@Serializable
data class SleepInputDto(val bed: String, val wake: String, val quality: Int? = null)

@Serializable
data class FocusInputDto(val topicId: String? = null, val text: String? = null)
