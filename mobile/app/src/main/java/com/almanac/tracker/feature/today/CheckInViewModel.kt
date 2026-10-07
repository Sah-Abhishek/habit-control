package com.almanac.tracker.feature.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.data.WriteResult
import com.almanac.tracker.core.model.DayEntryDto
import com.almanac.tracker.core.model.SleepInputDto
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CheckInDraft(
    val mood: Int? = null,
    val energy: Int? = null,
    val stress: Int? = null,
    val note: String = "",
    val bed: String = "",
    val wake: String = "",
    val quality: Int? = null,
)

class CheckInViewModel(private val date: String, container: AppContainer) : ViewModel() {
    private val repo = DaysRepository(container)
    val notices = Notices()
    private val _load = MutableStateFlow<Load<DayEntryDto>>(Load.Loading)
    val load: StateFlow<Load<DayEntryDto>> = _load.asStateFlow()
    val saving = MutableStateFlow(false)
    /** Field errors after a failed save; "_form" for general ones. */
    val errors = MutableStateFlow<Map<String, String>>(emptyMap())
    val done = MutableStateFlow(false)

    init {
        viewModelScope.launch { repo.entry(date).collect { _load.value = it } }
    }

    fun draftFrom(e: DayEntryDto?) = CheckInDraft(
        mood = e?.mood, energy = e?.energy, stress = e?.stress, note = e?.note.orEmpty(),
        bed = e?.sleep?.bed.orEmpty(), wake = e?.sleep?.wake.orEmpty(), quality = e?.sleep?.quality,
    )

    fun save(original: DayEntryDto?, d: CheckInDraft) {
        if (saving.value) return
        val local = buildMap {
            val anySleep = d.bed.isNotBlank() || d.wake.isNotBlank()
            if (anySleep) {
                if (d.bed.isBlank()) put("bed", "Add the time you went to bed")
                if (d.wake.isBlank()) put("wake", "Add the time you woke up")
                if (d.bed.isNotBlank() && d.wake.isNotBlank()) TodayMath.validateSleep(d.bed, d.wake)?.let { put("wake", it) }
            }
            if (d.note.length > 2000) put("note", "Keep notes under 2000 characters")
        }
        errors.value = local
        if (local.isNotEmpty()) return
        val o = draftFrom(original)
        fun <T> f(old: T?, new: T?): CheckInPatch.Field<T> = if (old == new) CheckInPatch.Field.Unchanged else CheckInPatch.Field.Set(new)
        val patch = CheckInPatch(f(o.mood, d.mood), f(o.energy, d.energy), f(o.stress, d.stress), f(o.note.ifBlank { null }, d.note.trim().ifBlank { null }))
        val sleepChanged = o.bed != d.bed || o.wake != d.wake || o.quality != d.quality
        saving.value = true
        viewModelScope.launch {
            var queued = false
            try {
                if (!patch.isEmpty) queued = repo.checkIn(date, patch) is WriteResult.Queued || queued
                if (sleepChanged) {
                    if (d.bed.isBlank() && d.wake.isBlank()) {
                        if (original?.sleep != null) repo.clearSleep(date)
                    } else {
                        queued = repo.setSleep(date, SleepInputDto(d.bed.trim(), d.wake.trim(), d.quality)) is WriteResult.Queued || queued
                    }
                }
                notices.send(if (queued) "Check-in saved on this phone — it will sync when you’re online." else "Check-in saved")
                done.value = true
            } catch (t: Throwable) {
                val e = t.toAppError()
                errors.value = (e as? AppError.Api)?.fieldErrors?.takeIf { it.isNotEmpty() } ?: mapOf("_form" to e.message)
            } finally {
                saving.value = false
            }
        }
    }
}
