package com.almanac.tracker.core

import android.content.Context
import com.almanac.tracker.BuildConfig
import com.almanac.tracker.core.auth.SessionRepository
import com.almanac.tracker.core.auth.TokenStore
import com.almanac.tracker.core.cache.ResponseCache
import com.almanac.tracker.core.data.CachedApi
import com.almanac.tracker.core.data.Mutations
import com.almanac.tracker.core.network.ApiClient
import com.almanac.tracker.core.network.NetworkMonitor
import com.almanac.tracker.core.sync.Outbox
import com.almanac.tracker.core.sync.SyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch

/** Manual dependency container — one instance per process, owned by [com.almanac.tracker.AlmanacApp]. */
class AppContainer(private val context: Context) {
    val appScope = CoroutineScope(SupervisorJob())

    val tokens = TokenStore(context)
    val cache = ResponseCache(context)
    val outbox = Outbox(context)
    val network = NetworkMonitor(context)

    private val _sessionExpired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    /** Emits when the server rejects our token; the UI returns to sign-in. */
    val sessionExpired: SharedFlow<Unit> = _sessionExpired.asSharedFlow()

    private val _dataChanged = MutableSharedFlow<Unit>(extraBufferCapacity = 8)
    /** Emits after any successful mutation or sync, so visible screens reload. */
    val dataChanged: SharedFlow<Unit> = _dataChanged.asSharedFlow()

    val api = ApiClient(
        baseUrl = BuildConfig.API_BASE_URL,
        tokenProvider = { tokens.token() },
        onUnauthorized = { onUnauthorized() },
    )
    val cachedApi = CachedApi(api, cache)
    val mutations = Mutations(api, outbox, onQueued = { SyncWorker.schedule(context) }, onChanged = { notifyChanged() })

    val session = SessionRepository(api, tokens, onSignedOut = { wipeLocalData() })

    fun notifyChanged() {
        _dataChanged.tryEmit(Unit)
    }

    fun onSyncCompleted() = notifyChanged()

    private suspend fun onUnauthorized() {
        tokens.clear()
        _sessionExpired.tryEmit(Unit)
    }

    /** Personal data must not outlive the session on a shared device. */
    private suspend fun wipeLocalData() {
        cache.clear()
        outbox.clear()
    }

    fun startSync() {
        appScope.launch { if (outbox.snapshot().isNotEmpty()) SyncWorker.schedule(context) }
    }
}
