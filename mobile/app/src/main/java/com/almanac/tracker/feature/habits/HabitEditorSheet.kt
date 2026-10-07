package com.almanac.tracker.feature.habits

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.HabitInput
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.FormError
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.Segmented
import com.almanac.tracker.ui.theme.Almanac
import kotlinx.coroutines.launch

private val DAY_LETTERS = listOf("S", "M", "T", "W", "T", "F", "S")
private val DAY_NAMES = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")

/** Create / edit a habit. [save] returns field errors, empty on success. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitEditorSheet(existing: HabitSummary?, onDismiss: () -> Unit, save: suspend (HabitInput) -> Map<String, String>) {
    val c = Almanac.colors
    val scope = rememberCoroutineScope()
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var kind by rememberSaveable { mutableStateOf(existing?.kind ?: "build") }
    var name by rememberSaveable { mutableStateOf(existing?.name ?: "") }
    var tracking by rememberSaveable { mutableStateOf(existing?.tracking ?: "binary") }
    var target by rememberSaveable { mutableStateOf(existing?.target?.let(::formatAmount) ?: "1") }
    var unit by rememberSaveable { mutableStateOf(existing?.unit ?: "") }
    var baseline by rememberSaveable { mutableStateOf(existing?.baseline?.let(::formatAmount) ?: "") }
    var days by rememberSaveable { mutableStateOf(existing?.scheduleDays ?: listOf(0, 1, 2, 3, 4, 5, 6)) }
    var sensitive by rememberSaveable { mutableStateOf(existing?.isSensitive ?: false) }
    var errors by rememberSaveable { mutableStateOf(mapOf<String, String>()) }
    var pending by rememberSaveable { mutableStateOf(false) }
    val reduce = kind == "reduce"
    val effectiveTracking = if (reduce) "quantity" else tracking

    fun submit() {
        if (pending) return
        val local = buildMap {
            if (name.isBlank()) put("name", "Give the habit a name")
            val t = target.replace(',', '.').toDoubleOrNull()
            if (effectiveTracking != "binary" && (t == null || t < 0)) put("target", "Enter a number of 0 or more")
            if (!reduce && effectiveTracking != "binary" && (t ?: 0.0) <= 0) put("target", "Set a daily target above zero")
            if (baseline.isNotBlank() && baseline.replace(',', '.').toDoubleOrNull() == null) put("baseline", "Enter a number")
            if (days.isEmpty()) put("scheduleDays", "Pick at least one day")
        }
        errors = local
        if (local.isNotEmpty()) return
        pending = true
        scope.launch {
            val result = save(
                HabitInput(
                    name = name.trim(), kind = kind, tracking = effectiveTracking,
                    target = if (effectiveTracking == "binary") 1.0 else target.replace(',', '.').toDouble(),
                    unit = unit.trim().ifEmpty { null }, scheduleDays = days.sorted(),
                    baseline = if (reduce) baseline.replace(',', '.').toDoubleOrNull() else null,
                    isSensitive = sensitive, goalId = existing?.goalId,
                ),
            )
            pending = false
            if (result.isEmpty()) onDismiss() else errors = result.mapKeys { it.key.removePrefix("data.") }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(if (existing == null) "New habit" else "Edit habit", style = Almanac.type.headline, color = c.ink)
            Text(
                if (reduce) "Track something you want to do less of. A slip is logged, never a reset." else "Something you want to do regularly.",
                style = Almanac.type.small, color = c.muted,
            )
            FormError(errors["_form"])
            if (existing == null) {
                Segmented(listOf("build" to "Build a habit", "reduce" to "Do less of"), kind, { kind = it; if (it == "reduce") { sensitive = true; if (target == "1") target = "3" } })
            }
            LabeledField("Name", name, { name = it.take(80) }, error = errors["name"], placeholder = if (reduce) "e.g. Late-night scrolling" else "e.g. Exercise")
            if (!reduce) {
                Text("How do you track it?", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.ink)
                Segmented(listOf("binary" to "Done", "quantity" to "Count", "duration" to "Minutes", "numeric" to "Number"), tracking, { tracking = it })
            }
            if (effectiveTracking != "binary") {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LabeledField(
                        if (reduce) "Daily limit" else "Daily target", target, { target = it.take(8) }, Modifier.weight(1f),
                        error = errors["target"], hint = if (reduce) "0 = stop completely" else null,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                    LabeledField("Unit", unit, { unit = it.take(20) }, Modifier.weight(1f), optional = true, placeholder = if (effectiveTracking == "duration") "min" else "times", error = errors["unit"])
                }
            }
            if (reduce) {
                LabeledField(
                    "Roughly how often per day now?", baseline, { baseline = it.take(8) }, optional = true,
                    hint = "Your baseline. Progress is measured against it.", error = errors["baseline"],
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
            }
            Text("Which days?", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.ink)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                DAY_LETTERS.forEachIndexed { i, letter ->
                    val on = i in days
                    Box(
                        Modifier.size(42.dp).clip(RoundedCornerShape(12.dp)).background(if (on) c.inverse else c.sunken)
                            .toggleable(on, role = Role.Checkbox) { days = if (on) days - i else days + i }
                            .semantics { contentDescription = DAY_NAMES[i] },
                        contentAlignment = Alignment.Center,
                    ) { Text(letter, style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = if (on) c.inverseInk else c.muted) }
                }
            }
            errors["scheduleDays"]?.let { Text(it, style = Almanac.type.caption, color = c.clay) }
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.duskSoft).toggleable(sensitive, role = Role.Checkbox) { sensitive = it }.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(sensitive, null, colors = CheckboxDefaults.colors(checkedColor = c.dusk))
                Text("Sensitive — left out of exports unless you include it.", style = Almanac.type.small, color = c.ink)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                AlmanacButton("Cancel", onDismiss, kind = ButtonKind.Ghost)
                AlmanacButton(if (existing == null) "Add habit" else "Save changes", ::submit, pending = pending)
            }
        }
    }
}
