package com.almanac.tracker.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.model.MeResponse
import com.almanac.tracker.core.model.SettingsDto
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

/** PATCH /settings body. Null fields are omitted (AppJson.explicitNulls = false). */
@Serializable
data class SettingsPatch(
    val timezone: String? = null,
    val theme: String? = null,
    val weekStartsOn: Int? = null,
    val dailyStudyTargetMin: Int? = null,
    val revisionScheduleDays: List<Int>? = null,
    val quietMode: Boolean? = null,
    val onboarded: Boolean? = null,
)

@Serializable
data class DeleteAccountBody(val email: String, val password: String)

class SettingsViewModel(private val container: AppContainer) : ViewModel() {
    private val _load = MutableStateFlow<Load<MeResponse>>(Load.Loading)
    val load: StateFlow<Load<MeResponse>> = _load.asStateFlow()
    val notices = Notices()
    private val _saving = MutableStateFlow<String?>(null)
    /** Which setting is currently saving (for per-row spinners / double-tap guards). */
    val saving: StateFlow<String?> = _saving.asStateFlow()
    private var job: Job? = null

    init { refresh() }

    fun refresh() {
        job?.cancel()
        job = viewModelScope.launch {
            container.cachedApi.stream("me", serializer = com.almanac.tracker.core.model.MeResponse.serializer()).collect { _load.value = it }
        }
    }

    /** Applies a patch; returns an error message or null. Settings change rarely, so this is online-only. */
    suspend fun patch(key: String, patch: SettingsPatch, success: String? = "Saved"): String? {
        if (_saving.value != null) return null
        _saving.value = key
        return try {
            val body = container.api.json().encodeToString(SettingsPatch.serializer(), patch)
            val updated = container.mutations.send("PATCH", "settings", body, SettingsDto.serializer())
            (_load.value as? Load.Ready)?.let { _load.value = Load.Ready(it.data.copy(settings = updated)) }
            success?.let { notices.send(it) }
            null
        } catch (t: Throwable) {
            val e = t.toAppError()
            (e as? AppError.Api)?.fieldErrors?.values?.firstOrNull() ?: e.message
        } finally {
            _saving.value = null
        }
    }

    fun signOut() = viewModelScope.launch { container.session.signOut() }

    /** Permanently deletes the account on the server, then clears this device. */
    suspend fun deleteAccount(email: String, password: String): String? = try {
        val body = container.api.json().encodeToString(DeleteAccountBody.serializer(), DeleteAccountBody(email.trim(), password))
        container.mutations.delete("account", body)
        container.session.signOut()
        null
    } catch (t: Throwable) {
        val e = t.toAppError()
        if (e is AppError.Unauthorized) null else ((e as? AppError.Api)?.fieldErrors?.values?.firstOrNull() ?: e.message)
    }
}
