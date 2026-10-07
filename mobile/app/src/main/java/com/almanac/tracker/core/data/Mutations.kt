package com.almanac.tracker.core.data

import com.almanac.tracker.core.network.ApiClient
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.core.sync.Outbox
import com.almanac.tracker.core.sync.OutboxOp
import kotlinx.serialization.KSerializer

/** Outcome of a write that may have been queued for later. */
sealed interface WriteResult<out T> {
    data class Saved<T>(val value: T) : WriteResult<T>
    /** Offline: kept on this device and will sync automatically. */
    data object Queued : WriteResult<Nothing>
}

class Mutations(
    val api: ApiClient,
    private val outbox: Outbox,
    private val onQueued: () -> Unit,
    private val onChanged: () -> Unit,
) {
    /**
     * Sends an idempotent PUT/PATCH; if the device is offline (or the server is
     * temporarily failing) it is queued and replayed later. Validation errors are thrown.
     */
    suspend fun <T> sendOrQueue(method: String, path: String, body: String, label: String, serializer: KSerializer<T>): WriteResult<T> {
        return try {
            val value = api.request(method, path, emptyMap(), body, serializer)
            onChanged()
            WriteResult.Saved(value)
        } catch (t: Throwable) {
            if (t is kotlinx.coroutines.CancellationException) throw t
            val error = t.toAppError()
            if (error is AppError.Offline || (error is AppError.Api && error.status >= 500)) {
                outbox.enqueue(OutboxOp(method = method, path = path, body = body, label = label))
                onQueued()
                WriteResult.Queued
            } else {
                throw error
            }
        }
    }

    /** Online-only write (creates, deletes, timers): throws [AppError] on failure. */
    suspend fun <T> send(method: String, path: String, body: String?, serializer: KSerializer<T>): T {
        val value = api.request(method, path, emptyMap(), body, serializer)
        onChanged()
        return value
    }

    suspend fun delete(path: String, body: String? = null) {
        api.delete(path, body)
        onChanged()
    }
}
