package com.almanac.tracker.feature.study

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.model.SessionDto
import com.almanac.tracker.core.model.SubjectSummaryDto
import com.almanac.tracker.core.model.StudyOverviewResponse
import com.almanac.tracker.core.model.TopicOption
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

data class WrapUpData(
    val session: SessionDto,
    val zone: ZoneId,
    val subjects: List<SubjectSummaryDto>,
    val topics: List<TopicOption>,
)

sealed interface WrapUpState {
    data object Loading : WrapUpState
    data class Ready(val data: WrapUpData) : WrapUpState
    data class Failed(val error: AppError) : WrapUpState
    /** The session no longer exists (deleted elsewhere). */
    data object Missing : WrapUpState
}

class WrapUpViewModel(private val id: String, private val container: AppContainer) : ViewModel() {
    private val repo = StudyRepository(container)
    val notices = Notices()
    private val _state = MutableStateFlow<WrapUpState>(WrapUpState.Loading)
    val state: StateFlow<WrapUpState> = _state.asStateFlow()
    val saving = MutableStateFlow(false)
    private val done = Channel<Unit>(Channel.BUFFERED)
    val doneFlow = done.receiveAsFlow()
    /** Current progress of the chosen topic, for the slider (null = unknown). */
    val topicProgress = MutableStateFlow<Int?>(null)

    init { load() }

    fun load() {
        _state.value = WrapUpState.Loading
        viewModelScope.launch {
            try {
                val zone = StudyMath.zoneOf(repo.timezone())
                val today = LocalDate.now(zone)
                val session = repo.findSession(id)
                if (session == null) {
                    _state.value = WrapUpState.Missing
                    return@launch
                }
                val subjects = runCatching {
                    container.cachedApi.fetch("study", serializer = StudyOverviewResponse.serializer()).subjects
                }.getOrDefault(emptyList())
                val topics = runCatching { repo.topicOptions() }.getOrDefault(emptyList())
                _state.value = WrapUpState.Ready(WrapUpData(session, zone, subjects, topics))
                loadTopicProgress(session.subjectId, session.topicId)
            } catch (t: Throwable) {
                _state.value = WrapUpState.Failed(t.toAppError())
            }
        }
    }

    fun loadTopicProgress(subjectId: String?, topicId: String?) {
        topicProgress.value = null
        if (subjectId == null || topicId == null) return
        viewModelScope.launch {
            topicProgress.value = runCatching {
                container.cachedApi.fetch("subjects/$subjectId", serializer = com.almanac.tracker.core.model.SubjectDetailResponse.serializer())
                    .topics.firstOrNull { it.id == topicId }?.progress
            }.getOrNull()
        }
    }

    /** Saves only what changed. Returns field errors (empty = saved or nothing to save). */
    fun save(details: SessionDetailsBody, onErrors: (Map<String, String>) -> Unit) {
        if (saving.value) return
        val empty = details == SessionDetailsBody()
        if (empty) {
            viewModelScope.launch { done.send(Unit) }
            return
        }
        saving.value = true
        viewModelScope.launch {
            try {
                repo.updateDetails(id, details)
                notices.send("Session details saved")
                done.send(Unit)
            } catch (t: Throwable) {
                val e = t.toAppError()
                onErrors((e as? AppError.Api)?.fieldErrors?.takeIf { it.isNotEmpty() } ?: mapOf("_form" to e.message))
            } finally {
                saving.value = false
            }
        }
    }

    fun editTimes(date: String, start: String, end: String, onResult: (Map<String, String>) -> Unit) {
        if (saving.value) return
        saving.value = true
        viewModelScope.launch {
            try {
                val updated = repo.editTimes(id, date, start, end)
                (state.value as? WrapUpState.Ready)?.let { _state.value = WrapUpState.Ready(it.data.copy(session = updated)) }
                notices.send("Times updated · ${StudyMath.formatDuration(updated.durationSeconds ?: 0)}")
                onResult(emptyMap())
            } catch (t: Throwable) {
                val e = t.toAppError()
                onResult((e as? AppError.Api)?.fieldErrors?.takeIf { it.isNotEmpty() } ?: mapOf("_form" to e.message))
            } finally {
                saving.value = false
            }
        }
    }

    fun delete() {
        if (saving.value) return
        saving.value = true
        viewModelScope.launch {
            try {
                repo.deleteSession(id)
                notices.send("Session deleted")
                done.send(Unit)
            } catch (t: Throwable) {
                notices.send(t.toAppError().message)
            } finally {
                saving.value = false
            }
        }
    }
}
