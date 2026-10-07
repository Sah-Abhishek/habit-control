package com.almanac.tracker.core.model

import kotlinx.serialization.Serializable

/** Mirrors docs/api.md → Study. */
@Serializable
data class SubjectSummaryDto(
    val id: String,
    val name: String,
    val goalId: String? = null,
    val goalTitle: String? = null,
    val weight: Int? = null,
    val progress: Double = 0.0,
    val topicCount: Int = 0,
    val completedTopics: Int = 0,
    val studySeconds: Long = 0,
    val archived: Boolean = false,
)

@Serializable
data class TopicRevisionDto(val id: String, val step: Int, val dueDate: String, val completedAt: String? = null, val skippedAt: String? = null)

@Serializable
data class TopicDto(
    val id: String,
    val subjectId: String,
    val name: String,
    val progress: Int = 0,
    val status: String = "not_started",
    val position: Int = 0,
    val revisions: List<TopicRevisionDto> = emptyList(),
)

@Serializable
data class DueRevisionDto(
    val id: String,
    val step: Int,
    val dueDate: String,
    val overdueDays: Int = 0,
    val topicId: String,
    val topicName: String,
    val subjectId: String,
    val subjectName: String,
)

@Serializable
data class SessionDto(
    val id: String,
    val subjectId: String? = null,
    val subjectName: String? = null,
    val topicId: String? = null,
    val topicName: String? = null,
    val method: String? = null,
    val startedAt: String,
    val endedAt: String? = null,
    val pausedAt: String? = null,
    val pausedSeconds: Long = 0,
    val localDate: String = "",
    val durationSeconds: Long? = null,
    val focus: Int? = null,
    val questionsAttempted: Int? = null,
    val questionsCorrect: Int? = null,
    val notes: String? = null,
    /** Present on running sessions: server-computed, excludes pauses. */
    val elapsedSeconds: Long? = null,
    val serverNow: String? = null,
)

@Serializable
data class StudyOverviewResponse(
    val subjects: List<SubjectSummaryDto> = emptyList(),
    val revisionsDue: List<DueRevisionDto> = emptyList(),
    val recentSessions: List<SessionDto> = emptyList(),
    val running: SessionDto? = null,
    val todaySeconds: Long = 0,
    val targetSeconds: Long = 0,
)

@Serializable
data class SubjectDetailResponse(
    val subject: SubjectSummaryDto,
    val topics: List<TopicDto> = emptyList(),
    val recentSessions: List<SessionDto> = emptyList(),
    val accuracy: Double? = null,
)

@Serializable
data class TopicOption(val id: String, val name: String, val subjectId: String, val subjectName: String)

@Serializable
data class TopicOptionsResponse(val topics: List<TopicOption> = emptyList())

@Serializable
data class FinishResponse(val session: SessionDto, val longSession: Boolean = false)

@Serializable
data class TallyResponse(val attempted: Int, val correct: Int)
