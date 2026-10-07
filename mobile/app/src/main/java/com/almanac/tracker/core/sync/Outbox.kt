package com.almanac.tracker.core.sync

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.almanac.tracker.core.network.AppJson
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.util.UUID

private val Context.outboxStore by preferencesDataStore(name = "outbox")

/** A change made while offline, replayed later. Only idempotent requests are allowed. */
@Serializable
data class OutboxOp(
    val id: String = UUID.randomUUID().toString(),
    val method: String, // PUT or PATCH
    val path: String, // relative to /api/v1/, e.g. "habits/<id>/logs/2026-10-07"
    val body: String,
    /** Shown to the user if the server later rejects it. */
    val label: String,
    val createdAt: Long = System.currentTimeMillis(),
)

/** A queued change the server refused (e.g. the habit was deleted on the web). */
@Serializable
data class OutboxFailure(val label: String, val message: String, val at: Long = System.currentTimeMillis())

class Outbox(private val context: Context) {
    private val opsKey = stringPreferencesKey("ops")
    private val failuresKey = stringPreferencesKey("failures")
    private val mutex = Mutex()
    private val opsSerializer = ListSerializer(OutboxOp.serializer())
    private val failSerializer = ListSerializer(OutboxFailure.serializer())

    val pending: Flow<List<OutboxOp>> = context.outboxStore.data.map { decode(it[opsKey]) }
    val failures: Flow<List<OutboxFailure>> = context.outboxStore.data.map { p ->
        p[failuresKey]?.let { runCatching { AppJson.decodeFromString(failSerializer, it) }.getOrNull() }.orEmpty()
    }

    private fun decode(raw: String?): List<OutboxOp> =
        raw?.let { runCatching { AppJson.decodeFromString(opsSerializer, it) }.getOrNull() }.orEmpty()

    /**
     * Queues an op. A later PUT to the same path replaces the earlier one (last write
     * wins), so tapping a habit five times offline sends one request.
     */
    suspend fun enqueue(op: OutboxOp) = mutex.withLock {
        require(op.method == "PUT" || op.method == "PATCH") { "Only idempotent ops can be queued" }
        context.outboxStore.edit { prefs ->
            val current = decode(prefs[opsKey])
            val next = if (op.method == "PUT") current.filterNot { it.method == "PUT" && it.path == op.path } + op else current + op
            prefs[opsKey] = AppJson.encodeToString(opsSerializer, next)
        }
    }

    suspend fun snapshot(): List<OutboxOp> = decode(context.outboxStore.data.first()[opsKey])

    suspend fun remove(id: String) = mutex.withLock {
        context.outboxStore.edit { prefs ->
            prefs[opsKey] = AppJson.encodeToString(opsSerializer, decode(prefs[opsKey]).filterNot { it.id == id })
        }
    }

    suspend fun recordFailure(failure: OutboxFailure) = mutex.withLock {
        context.outboxStore.edit { prefs ->
            val current = prefs[failuresKey]?.let { runCatching { AppJson.decodeFromString(failSerializer, it) }.getOrNull() }.orEmpty()
            prefs[failuresKey] = AppJson.encodeToString(failSerializer, (current + failure).takeLast(20))
        }
    }

    suspend fun dismissFailures() = mutex.withLock {
        context.outboxStore.edit { it.remove(failuresKey) }
    }

    suspend fun clear() = mutex.withLock {
        context.outboxStore.edit { it.clear() }
    }
}
