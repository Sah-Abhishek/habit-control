package com.almanac.tracker.core.data

import com.almanac.tracker.core.cache.ResponseCache
import com.almanac.tracker.core.network.ApiClient
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import android.util.Log
import kotlinx.serialization.KSerializer

/**
 * Cache-then-network reads. Emits cached data first (stale), then fresh data. If the
 * network fails and there is cached data, the screen keeps it and shows the error.
 */
class CachedApi(val api: ApiClient, private val cache: ResponseCache) {

    fun <T> stream(path: String, query: Map<String, String?> = emptyMap(), serializer: KSerializer<T>): Flow<Load<T>> = flow {
        val key = cacheKey(path, query)
        val cached = cache.read(key)?.let { decode(it, serializer) }
        if (cached != null) emit(Load.Ready(cached, stale = true, refreshing = true)) else emit(Load.Loading)
        try {
            val (response, text) = api.requestRaw("GET", path, query, null)
            response.close()
            val fresh = decode(text, serializer) ?: throw AppError.Unexpected()
            cache.write(key, text)
            emit(Load.Ready(fresh))
        } catch (t: Throwable) {
            if (t is kotlinx.coroutines.CancellationException) throw t
            val error = t.toAppError()
            // Diagnosable without exposing details in the UI. Never logs response bodies (personal data).
            Log.w(TAG, "GET $path failed: ${error::class.simpleName}", t)
            if (cached != null) emit(Load.Ready(cached, stale = true, error = error)) else emit(Load.Failed(error))
        }
    }

    /** Network only (for screens where stale data would mislead, e.g. a running timer). */
    suspend fun <T> fetch(path: String, query: Map<String, String?> = emptyMap(), serializer: KSerializer<T>): T {
        val (response, text) = api.requestRaw("GET", path, query, null)
        response.close()
        cache.write(cacheKey(path, query), text)
        return decode(text, serializer) ?: throw AppError.Unexpected()
    }

    private fun <T> decode(text: String, serializer: KSerializer<T>): T? =
        runCatching { api.json().decodeFromString(serializer, text) }
            .onFailure { Log.w(TAG, "Response didn't match ${serializer.descriptor.serialName}: ${it.message?.take(300)}") }
            .getOrNull()

    private companion object {
        const val TAG = "AlmanacApi"
    }

    private fun cacheKey(path: String, query: Map<String, String?>) =
        path + query.entries.filter { it.value != null }.sortedBy { it.key }.joinToString("&", prefix = "?") { "${it.key}=${it.value}" }
}
