package com.almanac.tracker.feature.today

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.data.WriteResult
import com.almanac.tracker.core.model.DueRevisionDto
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.core.model.TaskRowDto
import com.almanac.tracker.core.model.TodayResponse
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.feature.habits.HabitLogger
import com.almanac.tracker.feature.habits.HabitsRepository
import com.almanac.tracker.feature.plan.TasksRepository
import com.almanac.tracker.feature.study.StudyRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Local, not-yet-confirmed edits layered over the server's Today snapshot. */
data class TodayOverrides(
    val taskDone: Map<String, Boolean> = emptyMap(),
    val hiddenRevisions: Set<String> = emptySet(),
    val checkIn: Map<String, Int?> = emptyMap(),
)

class TodayViewModel(private val container: AppContainer) : ViewModel() {
    val days = DaysRepository(container)
    private val habitsRepo = HabitsRepository(container)
    private val tasks = TasksRepository(container)
    private val study = StudyRepository(container)
    val notices = Notices()
    val logger = HabitLogger(habitsRepo, viewModelScope, notices)

    private val _load = MutableStateFlow<Load<TodayResponse>>(Load.Loading)
    val load: StateFlow<Load<TodayResponse>> = _load.asStateFlow()
    private val _overrides = MutableStateFlow(TodayOverrides())
    val overrides: StateFlow<TodayOverrides> = _overrides.asStateFlow()
    /** elapsedRealtime when the latest snapshot arrived — anchors the running-session timer. */
    val receivedAt = MutableStateFlow(SystemClock.elapsedRealtime())
    private val inFlight = mutableSetOf<String>()
    private var job: Job? = null

    init {
        refresh()
        viewModelScope.launch { container.dataChanged.collect { refresh(quiet = true) } }
    }

    fun refresh(quiet: Boolean = false) {
        job?.cancel()
        job = viewModelScope.launch {
            days.today().collect {
                if (quiet && it is Load.Loading) return@collect
                _load.value = it
                if (it is Load.Ready && !it.stale) {
                    receivedAt.value = SystemClock.elapsedRealtime()
                    logger.clear()
                    _overrides.value = TodayOverrides()
                }
            }
        }
    }

    fun logHabit(h: HabitSummary, date: String, value: Double) =
        logger.set(h, date, logger.valueFor(h.id, date, h.today.value), value)

    fun toggleTask(task: TaskRowDto, done: Boolean) {
        if (!inFlight.add("task:${task.id}")) return // double-tap guard
        _overrides.update { it.copy(taskDone = it.taskDone + (task.id to done)) }
        viewModelScope.launch {
            try {
                when (tasks.setDone(task, done)) {
                    is WriteResult.Saved -> notices.send(if (done) "“${task.title}” done" else "“${task.title}” reopened") { undoTask(task, !done) }
                    WriteResult.Queued -> notices.send("Saved on this phone — will sync when you’re online.")
                }
            } catch (t: Throwable) {
                _overrides.update { it.copy(taskDone = it.taskDone - task.id) }
                notices.send(t.toAppError().message)
            } finally {
                inFlight.remove("task:${task.id}")
            }
        }
    }

    private suspend fun undoTask(task: TaskRowDto, done: Boolean) {
        _overrides.update { it.copy(taskDone = it.taskDone + (task.id to done)) }
        runCatching { tasks.setDone(task, done) }.onFailure { notices.send(it.toAppError().message) }
    }

    fun completeRevision(r: DueRevisionDto) = revisionAction(r, "Revision ${r.step} of ${r.topicName} done") { study.actOnRevision(r.id, snooze = false) }

    fun snoozeRevision(r: DueRevisionDto) = revisionAction(r, "${r.topicName} moved to tomorrow") { study.actOnRevision(r.id, snooze = true) }

    private fun revisionAction(r: DueRevisionDto, message: String, action: suspend () -> (suspend () -> Unit)) {
        if (!inFlight.add("rev:${r.id}")) return
        _overrides.update { it.copy(hiddenRevisions = it.hiddenRevisions + r.id) }
        viewModelScope.launch {
            try {
                val undo = action()
                notices.send(message) {
                    try {
                        undo()
                        _overrides.update { it.copy(hiddenRevisions = it.hiddenRevisions - r.id) }
                    } catch (t: Throwable) {
                        notices.send(t.toAppError().message)
                    }
                }
            } catch (t: Throwable) {
                _overrides.update { it.copy(hiddenRevisions = it.hiddenRevisions - r.id) }
                notices.send(t.toAppError().message)
            } finally {
                inFlight.remove("rev:${r.id}")
            }
        }
    }

    /** One-tap mood/energy/stress from the Today card. Tapping the same value clears it. */
    fun setScale(date: String, key: String, value: Int?) {
        val before = _overrides.value.checkIn
        _overrides.update { it.copy(checkIn = it.checkIn + (key to value)) }
        viewModelScope.launch {
            try {
                if (days.checkIn(date, CheckInPatch.of(key, value)) is WriteResult.Queued) {
                    notices.send("${key.replaceFirstChar { it.uppercase() }} saved on this phone — will sync.")
                }
            } catch (t: Throwable) {
                _overrides.update { it.copy(checkIn = before) }
                notices.send(t.toAppError().message)
            }
        }
    }

    val focusSaving = MutableStateFlow(false)

    fun setFocus(date: String, topicId: String?, text: String?, onDone: () -> Unit) {
        if (focusSaving.value) return
        focusSaving.value = true
        viewModelScope.launch {
            try {
                val queued = days.setFocus(date, topicId, text) is WriteResult.Queued
                notices.send(if (queued) "Focus saved on this phone — will sync." else if (topicId == null && text.isNullOrBlank()) "Focus cleared" else "Today’s focus set")
                onDone()
            } catch (t: Throwable) {
                notices.send(t.toAppError().message)
            } finally {
                focusSaving.value = false
            }
        }
    }
}
