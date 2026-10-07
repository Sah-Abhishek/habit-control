package com.almanac.tracker.core.data

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.almanac.tracker.ui.components.LocalMessenger
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow

/** One-off feedback from a ViewModel: a message with optional Undo. */
data class Notice(val message: String, val undo: (suspend () -> Unit)? = null)

/** Buffered so a notice emitted during a config change is not lost. */
class Notices {
    private val channel = Channel<Notice>(Channel.BUFFERED)
    val flow: Flow<Notice> = channel.receiveAsFlow()
    fun send(message: String, undo: (suspend () -> Unit)? = null) {
        channel.trySend(Notice(message, undo))
    }
}

/** Pipes a ViewModel's notices into the app snackbar. */
@Composable
fun CollectNotices(notices: Notices) {
    val messenger = LocalMessenger.current
    LaunchedEffect(notices) { notices.flow.collect { messenger.show(it.message, it.undo) } }
}
