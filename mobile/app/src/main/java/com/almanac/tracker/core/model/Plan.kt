package com.almanac.tracker.core.model

import kotlinx.serialization.Serializable

/** Mirrors docs/api.md → Tasks & Goals. */
@Serializable
data class TaskRowDto(
    val id: String,
    val title: String,
    val notes: String? = null,
    val dueDate: String? = null,
    val priority: String = "medium",
    val estimateMinutes: Int? = null,
    val completedAt: String? = null,
    val goalId: String? = null,
    val goalTitle: String? = null,
    val subjectId: String? = null,
    val subjectName: String? = null,
    val topicId: String? = null,
    val topicName: String? = null,
    val overdue: Boolean = false,
) {
    val done get() = completedAt != null
}

@Serializable
data class TasksResponse(val tasks: List<TaskRowDto> = emptyList())

@Serializable
data class IdTitle(val id: String, val title: String)

@Serializable
data class IdName(val id: String, val name: String)

@Serializable
data class TopicPick(val id: String, val name: String, val subjectId: String)

@Serializable
data class TaskOptionsResponse(val goals: List<IdTitle> = emptyList(), val subjects: List<IdName> = emptyList(), val topics: List<TopicPick> = emptyList())

@Serializable
data class TaskInputDto(
    val title: String,
    val notes: String? = null,
    val dueDate: String? = null,
    val priority: String = "medium",
    val goalId: String? = null,
    val subjectId: String? = null,
    val topicId: String? = null,
    val estimateMinutes: Int? = null,
)

@Serializable
data class DoneBody(val done: Boolean)

@Serializable
data class GoalCardDto(
    val id: String,
    val title: String,
    val description: String? = null,
    val status: String = "active",
    val startDate: String,
    val targetDate: String? = null,
    val isPrimary: Boolean = false,
    val progress: Double = 0.0,
    val expected: Double? = null,
    val pace: String? = null,
    val daysLeft: Int? = null,
    val estFinish: String? = null,
    val milestoneCount: Int = 0,
    val completedMilestones: Int = 0,
)

@Serializable
data class GoalsResponse(val goals: List<GoalCardDto> = emptyList())

@Serializable
data class MilestoneDto(val id: String, val title: String, val targetDate: String? = null, val progress: Int = 0, val position: Int = 0, val completed: Boolean = false)

@Serializable
data class GoalSubjectDto(val id: String, val name: String, val progress: Double = 0.0)

@Serializable
data class GoalHabitDto(val id: String, val name: String, val rate30: Double? = null)

@Serializable
data class GoalDetailResponse(
    val goal: GoalCardDto,
    val velocityPerWeek: Double? = null,
    val neededPerWeek: Double? = null,
    val milestones: List<MilestoneDto> = emptyList(),
    val subjects: List<GoalSubjectDto> = emptyList(),
    val habits: List<GoalHabitDto> = emptyList(),
    val tasks: List<TaskRowDto> = emptyList(),
)

@Serializable
data class GoalInputDto(val title: String, val description: String? = null, val startDate: String, val targetDate: String? = null, val isPrimary: Boolean? = null)

@Serializable
data class MilestoneInputDto(val title: String, val targetDate: String? = null, val progress: Int)

@Serializable
data class PrimaryMilestoneDto(val id: String, val title: String, val progress: Int = 0, val completed: Boolean = false)

@Serializable
data class PrimaryGoalDto(
    val id: String,
    val title: String,
    val progress: Double = 0.0,
    val targetDate: String? = null,
    val daysLeft: Int? = null,
    val expected: Double? = null,
    val status: String? = null,
    val estFinish: String? = null,
    val milestones: List<PrimaryMilestoneDto> = emptyList(),
)
