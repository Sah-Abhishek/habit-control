package com.almanac.tracker.feature.quicklog

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.data.WriteResult
import com.almanac.tracker.core.model.DueRevisionDto
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.core.model.TodayResponse
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.feature.habits.HabitLogger
import com.almanac.tracker.feature.habits.HabitsRepository
import com.almanac.tracker.feature.study.StudyRepository
import com.almanac.tracker.feature.today.CheckInPatch
import com.almanac.tracker.feature.today.DaysRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class QuickLogViewModel(container: AppContainer) : ViewModel() {
    private val days = DaysRepository(container)
    private val study = StudyRepository(container)
    val notices = Notices()
    val logger = HabitLogger(HabitsRepository(container), viewModelScope, notices)
    private val _today = MutableStateFlow<Load<TodayResponse>>(Load.Loading)
    val today: StateFlow<Load<TodayResponse>> = _today.asStateFlow()
    val busy = MutableStateFlow<String?>(null)
    val hiddenRevisions = MutableStateFlow<Set<String>>(emptySet())
    val scales = MutableStateFlow<Map<String, Int?>>(emptyMap())

    init {
        viewModelScope.launch { days.today().collect { _today.value = it } }
    }

    fun logHabit(h: HabitSummary, date: String, value: Double) =
        logger.set(h, date, logger.valueFor(h.id, date, h.today.value), value)

    /** Starts (or reopens) a session; [onStarted] navigates to the timer. Needs a connection. */
    fun startSession(topicId: String?, onStarted: () -> Unit) {
        if (busy.value != null) return
        busy.value = "session"
        viewModelScope.launch {
            try {
                study.start(null, topicId, null)
                onStarted()
            } catch (t: Throwable) {
                notices.send(t.toAppError().message)
            } finally {
                busy.value = null
            }
        }
    }

    fun setScale(date: String, key: String, value: Int?) {
        scales.update { it + (key to value) }
        viewModelScope.launch {
            try {
                val r = days.checkIn(date, CheckInPatch.of(key, value))
                notices.send(if (r is WriteResult.Queued) "Saved on this phone — will sync when you’re online." else "${key.replaceFirstChar { it.uppercase() }} logged")
            } catch (t: Throwable) {
                scales.update { it - key }
                notices.send(t.toAppError().message)
            }
        }
    }

    fun saveNote(date: String, note: String, onDone: () -> Unit) {
        if (busy.value != null) return
        busy.value = "note"
        viewModelScope.launch {
            try {
                val r = days.checkIn(date, CheckInPatch(note = CheckInPatch.Field.Set(note.trim().ifBlank { null })))
                notices.send(if (r is WriteResult.Queued) "Note saved on this phone — will sync." else "Note saved")
                onDone()
            } catch (t: Throwable) {
                notices.send(t.toAppError().message)
            } finally {
                busy.value = null
            }
        }
    }

    fun completeRevision(r: DueRevisionDto) {
        hiddenRevisions.update { it + r.id }
        viewModelScope.launch {
            try {
                val undo = study.actOnRevision(r.id, snooze = false)
                notices.send("Revision ${r.step} of ${r.topicName} done") {
                    try {
                        undo()
                        hiddenRevisions.update { it - r.id }
                    } catch (t: Throwable) {
                        notices.send(t.toAppError().message)
                    }
                }
            } catch (t: Throwable) {
                hiddenRevisions.update { it - r.id }
                notices.send(t.toAppError().message)
            }
        }
    }
}
