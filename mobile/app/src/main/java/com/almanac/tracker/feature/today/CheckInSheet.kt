package com.almanac.tracker.feature.today

import androidx.compose.foundation.background
import com.almanac.tracker.ui.components.currentLocale
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TimePickerDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.FormError
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.ScaleRow
import com.almanac.tracker.ui.components.SkeletonCard
import com.almanac.tracker.ui.components.errorBody
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Edit one day's check-in: mood, energy, stress, sleep (bed/wake, crossing midnight
 * allowed) and a note. Used from Today, Quick log and the Calendar day screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckInSheet(date: String, onDismiss: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "checkin-$date") { CheckInViewModel(date, container) }
    val load by vm.load.collectAsStateWithLifecycle()
    val saving by vm.saving.collectAsStateWithLifecycle()
    val errors by vm.errors.collectAsStateWithLifecycle()
    val done by vm.done.collectAsStateWithLifecycle()
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val c = Almanac.colors
    CollectNotices(vm.notices)
    LaunchedEffect(done) { if (done) onDismiss() }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            val locale = currentLocale()
            val label = runCatching { LocalDate.parse(date).format(DateTimeFormatter.ofPattern("EEEE · d MMMM", locale)) }.getOrDefault(date)
            MonoLabel(label)
            Text("Check-in", style = Almanac.type.headline, color = c.ink)
            Text("Everything here is optional. Tap a number again to clear it.", style = Almanac.type.small, color = c.muted)
            when (val l = load) {
                Load.Loading -> SkeletonCard(4)
                is Load.Failed -> {
                    FormError(errorBody(l.error))
                    // Still allow entering values: they queue offline.
                    Form(vm, null, saving, errors, onDismiss)
                }
                is Load.Ready -> Form(vm, l.data, saving, errors, onDismiss)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Form(vm: CheckInViewModel, entry: com.almanac.tracker.core.model.DayEntryDto?, saving: Boolean, errors: Map<String, String>, onDismiss: () -> Unit) {
    val c = Almanac.colors
    val initial = vm.draftFrom(entry)
    var mood by rememberSaveable(entry == null) { mutableStateOf(initial.mood) }
    var energy by rememberSaveable(entry == null) { mutableStateOf(initial.energy) }
    var stress by rememberSaveable(entry == null) { mutableStateOf(initial.stress) }
    var note by rememberSaveable(entry == null) { mutableStateOf(initial.note) }
    var bed by rememberSaveable(entry == null) { mutableStateOf(initial.bed) }
    var wake by rememberSaveable(entry == null) { mutableStateOf(initial.wake) }
    var quality by rememberSaveable(entry == null) { mutableStateOf(initial.quality) }
    var picking by rememberSaveable { mutableStateOf<String?>(null) }

    FormError(errors["_form"])
    ScaleBlock("Mood", AlmanacIcon.Smile, c.dusk, mood) { mood = it }
    ScaleBlock("Energy", AlmanacIcon.Bolt, c.ochre, energy) { energy = it }
    ScaleBlock("Stress", AlmanacIcon.Wave, c.clay, stress) { stress = it }

    Text("Sleep", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.ink)
    Text("The night that ended this morning. A bed time after the wake time means the evening before.", style = Almanac.type.caption, color = c.faint)
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        TimeChip("Bed", bed, errors["bed"], Modifier.weight(1f)) { picking = "bed" }
        TimeChip("Wake", wake, errors["wake"], Modifier.weight(1f)) { picking = "wake" }
    }
    val minutes = run {
        val b = TodayMath.parseClock(bed)
        val w = TodayMath.parseClock(wake)
        if (b != null && w != null && TodayMath.validateSleep(bed, wake) == null) TodayMath.sleepMinutes(b, w) else null
    }
    if (minutes != null) Text("≈ ${TodayMath.formatHours(minutes)} asleep", style = Almanac.type.caption, color = c.muted)
    if (bed.isNotBlank() || wake.isNotBlank()) {
        TextButton(onClick = { bed = ""; wake = ""; quality = null }) { Text("Clear sleep", color = c.clay, style = Almanac.type.small) }
    }
    Text("Sleep quality", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.ink)
    ScaleRow("Sleep quality", quality, { quality = it })

    LabeledField("Note", note, { note = it.take(2000) }, optional = true, singleLine = false, minLines = 2, error = errors["note"], placeholder = "Anything worth remembering about today")

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
        AlmanacButton("Cancel", onDismiss, kind = ButtonKind.Ghost)
        AlmanacButton("Save", { vm.save(entry, CheckInDraft(mood, energy, stress, note, bed, wake, quality)) }, pending = saving)
    }

    picking?.let { which ->
        val current = TodayMath.parseClock(if (which == "bed") bed else wake) ?: if (which == "bed") 23 * 60 else 7 * 60
        val state = rememberTimePickerState(initialHour = current / 60, initialMinute = current % 60, is24Hour = true)
        AlertDialog(
            onDismissRequest = { picking = null },
            title = { Text(if (which == "bed") "Went to bed" else "Woke up") },
            text = { TimePicker(state, colors = TimePickerDefaults.colors(selectorColor = c.moss)) },
            confirmButton = {
                TextButton({
                    val v = TodayMath.formatClockTime(state.hour * 60 + state.minute)
                    if (which == "bed") bed = v else wake = v
                    picking = null
                }) { Text("Set") }
            },
            dismissButton = { TextButton({ picking = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ScaleBlock(label: String, icon: AlmanacIcon, tint: androidx.compose.ui.graphics.Color, value: Int?, onSelect: (Int?) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            AIcon(icon, null, tint, 14.dp)
            Text(label, style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = Almanac.colors.ink)
            Text(value?.let { "· $it / 10" } ?: "· not set", style = Almanac.type.caption, color = Almanac.colors.faint)
        }
        ScaleRow(label, value, onSelect)
    }
}

@Composable
private fun TimeChip(label: String, value: String, error: String?, modifier: Modifier, onClick: () -> Unit) {
    val c = Almanac.colors
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Column(
            Modifier.fillMaxWidth().heightIn(min = 56.dp).clip(RoundedCornerShape(12.dp)).background(c.card)
                .border(1.dp, if (error != null) c.clay else c.line, RoundedCornerShape(12.dp))
                .clickable(role = Role.Button, onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp)
                .semantics { contentDescription = "$label time ${value.ifBlank { "not set" }}" },
        ) {
            MonoLabel(label)
            Text(value.ifBlank { "--:--" }, style = Almanac.type.dataLarge, color = if (value.isBlank()) c.faint else c.ink)
        }
        if (error != null) Text(error, style = Almanac.type.caption, color = c.clay)
    }
}
