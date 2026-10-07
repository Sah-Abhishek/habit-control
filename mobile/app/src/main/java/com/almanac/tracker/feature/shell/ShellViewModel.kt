package com.almanac.tracker.feature.shell

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.MeResponse
import com.almanac.tracker.core.sync.OutboxFailure
import com.almanac.tracker.ui.theme.ThemePreference
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.ZoneId

data class ShellState(
    val me: MeResponse? = null,
    val online: Boolean = true,
    val pendingChanges: Int = 0,
    val failures: List<OutboxFailure> = emptyList(),
) {
    val theme: ThemePreference
        get() = when (me?.settings?.theme) {
            "light" -> ThemePreference.Light
            "dark" -> ThemePreference.Dark
            else -> ThemePreference.System
        }
}

class ShellViewModel(private val container: AppContainer) : ViewModel() {
    private val me = MutableStateFlow<MeResponse?>(null)

    val state: StateFlow<ShellState> = combine(me, container.network.online, container.outbox.pending, container.outbox.failures) { me, online, pending, failures ->
        ShellState(me, online, pending.size, failures)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ShellState())

    init {
        refreshMe()
        viewModelScope.launch { container.dataChanged.collect { refreshMe() } }
        // Coming back online: flush anything queued.
        viewModelScope.launch {
            container.network.online.collect { online -> if (online) container.startSync() }
        }
    }

    fun refreshMe() {
        viewModelScope.launch {
            container.cachedApi.stream("me", serializer = MeResponse.serializer()).collect { load ->
                if (load is Load.Ready) {
                    me.value = load.data
                    if (!load.stale) adoptDeviceTimezone(load.data)
                }
            }
        }
    }

    private var timezoneAdopted = false

    /**
     * Accounts start in UTC. Like the website does after sign-up, adopt this phone's
     * timezone while the account is still on the default, so "today" matches the user's day.
     * An explicit choice in Settings (anything but UTC) is never overridden.
     */
    private fun adoptDeviceTimezone(me: MeResponse) {
        if (timezoneAdopted || me.settings.timezone != "UTC") return
        val device = ZoneId.systemDefault().id
        if (device == "UTC" || device == "Etc/UTC") return
        timezoneAdopted = true
        viewModelScope.launch {
            runCatching {
                val body = buildJsonObject { put("timezone", device) }.toString()
                container.mutations.send("PATCH", "settings", body, com.almanac.tracker.core.model.SettingsDto.serializer())
            }.onFailure { timezoneAdopted = false }
        }
    }

    fun dismissFailures() = viewModelScope.launch { container.outbox.dismissFailures() }

    fun retrySync() = viewModelScope.launch { container.startSync() }
}

