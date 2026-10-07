package com.almanac.tracker.feature.plan

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.theme.Almanac
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

@Composable
private fun FieldLabel(label: String, optional: Boolean) {
    Text(
        if (optional) "$label  ·  optional" else label,
        style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold),
        color = Almanac.colors.ink,
    )
}

@Composable
private fun FieldBox(text: String, placeholder: Boolean, error: String?, description: String, onClick: () -> Unit, trailing: @Composable () -> Unit = {}) {
    val c = Almanac.colors
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, if (error != null) c.clay else c.line, RoundedCornerShape(12.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description }
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, style = Almanac.type.body, color = if (placeholder) c.faint else c.ink, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        trailing()
    }
}

/** Date field backed by the Material date picker; `value` is YYYY-MM-DD or null. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(label: String, value: String?, onChange: (String?) -> Unit, optional: Boolean = false, error: String? = null, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    val c = Almanac.colors
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FieldLabel(label, optional)
        FieldBox(
            text = value?.let { PlanLogic.formatDate(it) } ?: "No date",
            placeholder = value == null,
            error = error,
            description = "$label: ${value ?: "none"}. Tap to choose",
            onClick = { open = true },
        ) {
            if (value != null && optional) {
                Box(Modifier.clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { onChange(null) }.padding(6.dp).semantics { contentDescription = "Clear $label" }) {
                    AIcon(AlmanacIcon.Close, null, c.muted, 16.dp)
                }
            } else {
                AIcon(AlmanacIcon.Calendar, null, c.muted, 18.dp)
            }
        }
        if (error != null) Text(error, style = Almanac.type.caption, color = c.clay)
    }
    if (open) {
        val initial = PlanLogic.parse(value)?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli()
        val state = rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton({
                    state.selectedDateMillis?.let { onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()) }
                    open = false
                }) { Text("Done") }
            },
            dismissButton = {
                if (optional) TextButton({ onChange(null); open = false }) { Text("Clear") }
                TextButton({ open = false }) { Text("Cancel") }
            },
        ) { DatePicker(state) }
    }
}

/** Single-choice dropdown. `options` = (id, label); null id = "None". */
@Composable
fun PickerField(label: String, value: String?, options: List<Pair<String, String>>, onChange: (String?) -> Unit, optional: Boolean = true, enabled: Boolean = true, emptyHint: String? = null, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    val c = Almanac.colors
    val current = options.firstOrNull { it.first == value }?.second
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FieldLabel(label, optional)
        Box {
            FieldBox(
                text = current ?: if (!enabled && emptyHint != null) emptyHint else "None",
                placeholder = current == null,
                error = null,
                description = "$label: ${current ?: "none"}",
                onClick = { if (enabled) open = true },
            ) { AIcon(AlmanacIcon.Down, null, if (enabled) c.muted else c.faint, 16.dp) }
            DropdownMenu(open, { open = false }) {
                if (optional) DropdownMenuItem({ Text("None") }, { onChange(null); open = false })
                options.forEach { (id, name) -> DropdownMenuItem({ Text(name, maxLines = 2) }, { onChange(id); open = false }) }
            }
        }
    }
}
