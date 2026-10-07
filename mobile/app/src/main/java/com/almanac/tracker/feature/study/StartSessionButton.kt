package com.almanac.tracker.feature.study

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.navigation.SessionKey
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.LocalMessenger
import kotlinx.coroutines.launch

/**
 * Starts a focus session (or picks up the one already running) and opens the timer.
 * Guarded against double taps; starting needs a connection because the server owns the clock.
 */
@Composable
fun StartSessionButton(
    subjectId: String?,
    topicId: String?,
    label: String = "Start session",
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Accent,
    small: Boolean = false,
) {
    val container = LocalAppContainer.current
    val nav = LocalNavigator.current
    val messenger = LocalMessenger.current
    val scope = rememberCoroutineScope()
    val repo = remember(container) { StudyRepository(container) }
    var pending by remember { mutableStateOf(false) }

    AlmanacButton(
        label,
        onClick = {
            if (pending) return@AlmanacButton
            pending = true
            scope.launch {
                try {
                    val session = repo.start(subjectId, topicId, null)
                    // The server hands back the existing session if one was already running.
                    if ((session.elapsedSeconds ?: 0) > 10) messenger.show("You already had a session running — picked it up.")
                    nav.go(SessionKey)
                } catch (t: Throwable) {
                    val e = t.toAppError()
                    messenger.error(if (e is AppError.Offline) "Starting a session needs a connection — the timer is kept on the server so it survives restarts." else e.message)
                } finally {
                    pending = false
                }
            }
        },
        modifier = modifier,
        kind = kind,
        icon = AlmanacIcon.Play,
        pending = pending,
        small = small,
    )
}
