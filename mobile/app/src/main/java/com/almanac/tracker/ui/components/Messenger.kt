package com.almanac.tracker.ui.components

import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.staticCompositionLocalOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * App-wide feedback: success messages with optional Undo (instead of confirmation
 * dialogs for reversible actions) and errors. Backed by a Material snackbar host.
 */
class Messenger(private val host: SnackbarHostState, private val scope: CoroutineScope) {
    fun show(message: String, undo: (suspend () -> Unit)? = null) {
        scope.launch {
            host.currentSnackbarData?.dismiss()
            val result = host.showSnackbar(message, actionLabel = if (undo != null) "Undo" else null, withDismissAction = undo == null, duration = if (undo != null) SnackbarDuration.Long else SnackbarDuration.Short)
            if (result == SnackbarResult.ActionPerformed) undo?.invoke()
        }
    }

    fun error(message: String) = show(message)
}

val LocalMessenger = staticCompositionLocalOf<Messenger> { error("Messenger not provided") }
