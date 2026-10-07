package com.almanac.tracker.feature.study

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.model.SessionDto
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import java.time.Instant

/** Base for the on-screen clock: server elapsed at [anchorMs] on the monotonic clock. */
data class TimerBase(val baseElapsed: Long, val anchorMs: Long, val paused: Boolean, val approximate: Boolean)

data class FocusUi(
    val load: Load<SessionDto?> = Load.Loading,
    val timer: TimerBase? = null,
    val attempted: Int = 0,
    val correct: Int = 0,
    val method: String? = null,
    val busy: Boolean = false,
)

sealed interface FocusEvent {
    data class Finished(val id: String, val longSession: Boolean) : FocusEvent
    data object Discarded : FocusEvent
}

class FocusSessionViewModel(container: AppContainer) : ViewModel() {
    private val repo = StudyRepository(container)
    val notices = Notices()
    private val _ui = MutableStateFlow(FocusUi())
    val ui: StateFlow<FocusUi> = _ui.asStateFlow()
    private val events = Channel<FocusEvent>(Channel.BUFFERED)
    val eventFlow = events.receiveAsFlow()
    private var job: Job? = null
    private var tallyJobs = 0

    init { refresh() }

    /** Re-reads the running session from the server (also after process death). */
    fun refresh() {
        job?.cancel()
        job = viewModelScope.launch {
            repo.runningStream().collect { load ->
                val s = (load as? Load.Ready)?.data
                _ui.value = _ui.value.copy(
                    load = load,
                    timer = s?.let { timerFrom(it, approximate = (load as Load.Ready).stale) } ?: _ui.value.timer.takeIf { load is Load.Loading },
                    // Server counts win unless a tally is still in flight.
                    attempted = if (tallyJobs == 0) s?.questionsAttempted ?: 0 else _ui.value.attempted,
                    correct = if (tallyJobs == 0) s?.questionsCorrect ?: 0 else _ui.value.correct,
                    method = s?.method,
                )
            }
        }
    }

    private fun timerFrom(s: SessionDto, approximate: Boolean): TimerBase {
        val now = SystemClock.elapsedRealtime()
        var base = s.elapsedSeconds ?: 0
        val paused = s.pausedAt != null
        if (approximate && !paused) {
            // Cached data: estimate time since the server answered using the wall clock (display only).
            val serverNow = s.serverNow?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
            if (serverNow != null) base += ((System.currentTimeMillis() - serverNow) / 1000).coerceAtLeast(0)
        }
        return TimerBase(base, now, paused, approximate)
    }

    private fun session(): SessionDto? = (_ui.value.load as? Load.Ready)?.data

    private fun applyServer(s: SessionDto) {
        _ui.value = _ui.value.copy(load = Load.Ready(s), timer = timerFrom(s, approximate = false), method = s.method)
    }

    private fun failure(t: Throwable, action: String) {
        val e = t.toAppError()
        notices.send(
            when (e) {
                is AppError.Offline -> "$action needs a connection. The timer keeps running on the server either way."
                else -> e.message
            },
        )
    }

    private fun busyAction(action: String, block: suspend (SessionDto) -> Unit) {
        val s = session() ?: return
        if (_ui.value.busy) return
        _ui.value = _ui.value.copy(busy = true)
        viewModelScope.launch {
            try { block(s) } catch (t: Throwable) { failure(t, action) } finally { _ui.value = _ui.value.copy(busy = false) }
        }
    }

    fun togglePause() = busyAction(if (_ui.value.timer?.paused == true) "Resuming" else "Pausing") { s ->
        applyServer(if (s.pausedAt != null) repo.resume(s.id) else repo.pause(s.id))
    }

    /** Optimistic tally; rolls back if the server refuses. Persisted on every tap. */
    fun tally(correct: Boolean, undo: Boolean = false) {
        val s = session() ?: return
        val before = _ui.value
        val dAttempted = if (undo) -1 else 1
        if (undo && (before.attempted == 0 || (correct && before.correct == 0) || (!correct && before.attempted - before.correct == 0))) return
        _ui.value = before.copy(attempted = before.attempted + dAttempted, correct = before.correct + if (correct) dAttempted else 0)
        tallyJobs++
        viewModelScope.launch {
            try {
                val r = repo.tally(s.id, (if (undo) "undo-" else "") + if (correct) "correct" else "missed")
                if (tallyJobs == 1) _ui.value = _ui.value.copy(attempted = r.attempted, correct = r.correct)
            } catch (t: Throwable) {
                _ui.value = _ui.value.copy(
                    attempted = _ui.value.attempted - dAttempted,
                    correct = _ui.value.correct - if (correct) dAttempted else 0,
                )
                failure(t, "Saving that answer")
            } finally {
                tallyJobs--
            }
        }
    }

    fun setMethod(method: String) {
        val s = session() ?: return
        val previous = _ui.value.method
        if (previous == method) return
        _ui.value = _ui.value.copy(method = method)
        viewModelScope.launch {
            try { repo.updateDetails(s.id, SessionDetailsBody(method = method)) } catch (t: Throwable) {
                _ui.value = _ui.value.copy(method = previous)
                failure(t, "Changing the method")
            }
        }
    }

    fun finish() = busyAction("Finishing") { s ->
        val r = repo.finish(s.id)
        events.send(FocusEvent.Finished(r.session.id, r.longSession))
    }

    fun discard() = busyAction("Discarding") { s ->
        repo.deleteSession(s.id)
        notices.send("Session discarded")
        events.send(FocusEvent.Discarded)
    }
}
