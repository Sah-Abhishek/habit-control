package com.almanac.tracker.feature.study

import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.FinishResponse
import com.almanac.tracker.core.model.MeResponse
import com.almanac.tracker.core.model.SessionDto
import com.almanac.tracker.core.model.StudyOverviewResponse
import com.almanac.tracker.core.model.SubjectDetailResponse
import com.almanac.tracker.core.model.SubjectSummaryDto
import com.almanac.tracker.core.model.TallyResponse
import com.almanac.tracker.core.model.TaskOptionsResponse
import com.almanac.tracker.core.model.TopicDto
import com.almanac.tracker.core.model.TopicOption
import com.almanac.tracker.core.model.TopicOptionsResponse
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.nullable
import java.util.concurrent.ConcurrentHashMap

@Serializable internal data class StartBody(val subjectId: String? = null, val topicId: String? = null, val method: String? = null)
@Serializable internal data class TallyBody(val result: String)
@Serializable internal data class SubjectBody(val name: String, val goalId: String? = null, val weight: Int? = null)
@Serializable internal data class NameBody(val name: String)
@Serializable internal data class TopicPatchBody(val name: String? = null, val progress: Int? = null)
@Serializable internal data class CompletedBody(val completed: Boolean)
@Serializable internal data class TimesBody(val date: String, val startTime: String, val endTime: String)
@Serializable data class WasCompleted(val wasCompleted: Boolean = false)
@Serializable data class SnoozeResult(val previousDueDate: String? = null)
@Serializable data class Reopened(val reopened: Boolean = true)
@Serializable data class DueBody(val dueDate: String)
@Serializable data class SessionsResponse(val sessions: List<SessionDto> = emptyList())

/** Fields of the wrap-up; null = leave unchanged (absent from the JSON body). */
@Serializable
data class SessionDetailsBody(
    val focus: Int? = null,
    val method: String? = null,
    val questionsAttempted: Int? = null,
    val questionsCorrect: Int? = null,
    val notes: String? = null,
    val subjectId: String? = null,
    val topicId: String? = null,
    val topicProgress: Int? = null,
)

@Serializable
data class PastSessionBody(
    val subjectId: String? = null,
    val topicId: String? = null,
    val method: String? = null,
    val date: String,
    val startTime: String,
    val endTime: String,
    val focus: Int? = null,
    val questionsAttempted: Int? = null,
    val questionsCorrect: Int? = null,
    val notes: String? = null,
)

/** Data access for Study (docs/api.md → Study). Timer actions are online-only by design. */
class StudyRepository(private val container: AppContainer) {
    private val json get() = container.api.json()
    private val m get() = container.mutations
    private inline fun <reified B> enc(serializer: KSerializer<B>, body: B) = json.encodeToString(serializer, body)

    fun overview(): Flow<Load<StudyOverviewResponse>> = container.cachedApi.stream("study", serializer = StudyOverviewResponse.serializer())

    fun subject(id: String): Flow<Load<SubjectDetailResponse>> = container.cachedApi.stream("subjects/$id", serializer = SubjectDetailResponse.serializer())

    /** Cached-then-fresh running session (`null` = none running). */
    fun runningStream(): Flow<Load<SessionDto?>> = container.cachedApi.stream("sessions/running", serializer = SessionDto.serializer().nullable)

    suspend fun running(): SessionDto? = container.cachedApi.fetch("sessions/running", serializer = SessionDto.serializer().nullable)

    /** Starts a session; if one is already running the server returns that one instead. */
    suspend fun start(subjectId: String?, topicId: String?, method: String?): SessionDto =
        m.send("POST", "sessions", enc(StartBody.serializer(), StartBody(subjectId, topicId, method)), SessionDto.serializer())

    suspend fun pause(id: String): SessionDto = m.send("POST", "sessions/$id/pause", null, SessionDto.serializer())
    suspend fun resume(id: String): SessionDto = m.send("POST", "sessions/$id/resume", null, SessionDto.serializer())

    /** result: correct | missed | undo-correct | undo-missed */
    suspend fun tally(id: String, result: String): TallyResponse =
        container.api.request("POST", "sessions/$id/tally", emptyMap(), enc(TallyBody.serializer(), TallyBody(result)), TallyResponse.serializer())

    suspend fun finish(id: String): FinishResponse =
        m.send("POST", "sessions/$id/finish", null, FinishResponse.serializer()).also { FinishedSessions.put(it.session) }

    suspend fun updateDetails(id: String, details: SessionDetailsBody): SessionDto =
        m.send("PATCH", "sessions/$id", enc(SessionDetailsBody.serializer(), details), SessionDto.serializer()).also { FinishedSessions.put(it) }

    suspend fun editTimes(id: String, date: String, startTime: String, endTime: String): SessionDto =
        m.send("PUT", "sessions/$id/times", enc(TimesBody.serializer(), TimesBody(date, startTime, endTime)), SessionDto.serializer()).also { FinishedSessions.put(it) }

    suspend fun logPast(body: PastSessionBody): SessionDto = m.send("POST", "sessions/past", enc(PastSessionBody.serializer(), body), SessionDto.serializer())

    suspend fun deleteSession(id: String) {
        m.delete("sessions/$id")
        FinishedSessions.remove(id)
    }

    suspend fun sessions(from: String, to: String): List<SessionDto> =
        container.api.request("GET", "sessions", mapOf("from" to from, "to" to to), null, SessionsResponse.serializer()).sessions

    suspend fun getSession(id: String): SessionDto = container.api.request("GET", "sessions/$id", emptyMap(), null, SessionDto.serializer())

    /** A session for the wrap-up: the in-memory hand-off from finish(), else GET sessions/{id}. Null if it no longer exists. */
    suspend fun findSession(id: String): SessionDto? = FinishedSessions.get(id) ?: try {
        getSession(id).also { FinishedSessions.put(it) }
    } catch (e: com.almanac.tracker.core.network.AppError.Api) {
        if (e.status == 404) null else throw e
    }

    suspend fun completeRevision(id: String): WasCompleted = m.send("POST", "revisions/$id/complete", null, WasCompleted.serializer())
    suspend fun snoozeRevision(id: String): SnoozeResult = m.send("POST", "revisions/$id/snooze", null, SnoozeResult.serializer())

    /** Undo for completeRevision. */
    suspend fun reopenRevision(id: String) {
        m.send("POST", "revisions/$id/reopen", null, Reopened.serializer())
    }

    /** Undo for snoozeRevision: restores the previous due date. */
    suspend fun setRevisionDue(id: String, dueDate: String) {
        m.send("PUT", "revisions/$id/due", container.api.json().encodeToString(DueBody.serializer(), DueBody(dueDate)), DueBody.serializer())
    }

    /** Runs complete/snooze and returns the matching undo action. */
    suspend fun actOnRevision(id: String, snooze: Boolean): suspend () -> Unit =
        if (snooze) {
            val prev = snoozeRevision(id).previousDueDate
            ({ if (prev != null) setRevisionDue(id, prev) })
        } else {
            completeRevision(id)
            ({ reopenRevision(id) })
        }

    suspend fun createSubject(name: String, goalId: String?, weight: Int?): SubjectSummaryDto =
        m.send("POST", "subjects", enc(SubjectBody.serializer(), SubjectBody(name.trim(), goalId, weight)), SubjectSummaryDto.serializer())

    suspend fun updateSubject(id: String, name: String, goalId: String?, weight: Int?): SubjectSummaryDto =
        m.send("PATCH", "subjects/$id", enc(SubjectBody.serializer(), SubjectBody(name.trim(), goalId, weight)), SubjectSummaryDto.serializer())

    suspend fun deleteSubject(id: String) = m.delete("subjects/$id")

    suspend fun addTopic(subjectId: String, name: String): TopicDto =
        m.send("POST", "subjects/$subjectId/topics", enc(NameBody.serializer(), NameBody(name.trim())), TopicDto.serializer())

    suspend fun renameTopic(id: String, name: String): TopicDto =
        m.send("PATCH", "topics/$id", enc(TopicPatchBody.serializer(), TopicPatchBody(name = name.trim())), TopicDto.serializer())

    suspend fun setTopicProgress(id: String, progress: Int): TopicDto =
        m.send("PATCH", "topics/$id", enc(TopicPatchBody.serializer(), TopicPatchBody(progress = progress.coerceIn(0, 100))), TopicDto.serializer())

    suspend fun setTopicCompleted(id: String, completed: Boolean): TopicDto =
        m.send("PUT", "topics/$id/completed", enc(CompletedBody.serializer(), CompletedBody(completed)), TopicDto.serializer())

    suspend fun deleteTopic(id: String) = m.delete("topics/$id")

    suspend fun topicOptions(): List<TopicOption> = container.cachedApi.fetch("topics/options", serializer = TopicOptionsResponse.serializer()).topics

    /** Goals for the "linked goal" picker (shared with the task options endpoint). */
    suspend fun goalOptions() = container.cachedApi.fetch("tasks/options", serializer = TaskOptionsResponse.serializer()).goals

    suspend fun timezone(): String? = runCatching { container.cachedApi.fetch("me", serializer = MeResponse.serializer()).settings.timezone }.getOrNull()

}

/** Process-wide hand-off of just-finished sessions to the wrap-up screen. */
internal object FinishedSessions {
    private val map = ConcurrentHashMap<String, SessionDto>()
    fun put(s: SessionDto) { map[s.id] = s }
    fun get(id: String): SessionDto? = map[id]
    fun remove(id: String) { map.remove(id) }
}
