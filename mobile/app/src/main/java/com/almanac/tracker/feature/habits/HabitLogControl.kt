package com.almanac.tracker.feature.habits

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
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
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.clickable
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.theme.Almanac

/** Format 2.0 → "2", 2.5 → "2.5". */
fun formatAmount(v: Double): String = if (v % 1.0 == 0.0) v.toLong().toString() else "%.1f".format(v).trimEnd('0').trimEnd('.')

/**
 * One-tap logging for a habit on a day. Shows [value] optimistically supplied by the
 * caller; [onSet] receives the new absolute value (idempotent, offline-safe).
 */
@Composable
fun HabitLogControl(habit: HabitSummary, value: Double, onSet: (Double) -> Unit, enabled: Boolean = true, large: Boolean = false) {
    val c = Almanac.colors
    val dim = if (large) 44.dp else 38.dp
    when {
        habit.isBinary -> {
            val done = value >= 1
            Box(
                Modifier
                    .size(dim)
                    .clip(CircleShape)
                    .then(if (done) Modifier.background(c.moss) else Modifier.border(1.5.dp, c.line, CircleShape))
                    .clickable(enabled = enabled, role = Role.Checkbox) { onSet(if (done) 0.0 else 1.0) }
                    .semantics {
                        contentDescription = habit.name
                        stateDescription = if (done) "Done" else "Not done"
                    },
                contentAlignment = Alignment.Center,
            ) {
                if (done) AIcon(AlmanacIcon.Check, null, c.mossOn, 18.dp)
            }
        }
        habit.isReduce || habit.tracking == "quantity" -> {
            val over = habit.isReduce && value > habit.target
            val (bg, fg) = when {
                habit.isReduce && over -> c.clay to c.card
                habit.isReduce -> c.claySoft to c.clay
                value >= habit.target -> c.moss to c.mossOn
                else -> c.mossSoft to c.moss
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { onSet((value - 1).coerceAtLeast(0.0)) }, enabled = enabled && value > 0, modifier = Modifier.size(36.dp)) {
                    AIcon(AlmanacIcon.Minus, "Remove one from ${habit.name}", c.muted, 16.dp)
                }
                Box(Modifier.size(dim).clip(CircleShape).background(bg).semantics { contentDescription = "${habit.name} today: ${formatAmount(value)}" }, contentAlignment = Alignment.Center) {
                    Text(formatAmount(value), style = Almanac.type.data, color = fg)
                }
                IconButton(onClick = { onSet(value + 1) }, enabled = enabled, modifier = Modifier.size(36.dp)) {
                    AIcon(AlmanacIcon.Plus, "Add one to ${habit.name}", c.muted, 16.dp)
                }
            }
        }
        else -> AmountEntry(habit, value, onSet, enabled)
    }
}

@Composable
private fun AmountEntry(habit: HabitSummary, value: Double, onSet: (Double) -> Unit, enabled: Boolean) {
    val c = Almanac.colors
    var draft by remember(value) { mutableStateOf("") }
    val unit = habit.unit ?: if (habit.tracking == "duration") "min" else ""
    val commit = {
        draft.trim().replace(',', '.').toDoubleOrNull()?.takeIf { it >= 0 && it <= 100_000 }?.let { onSet(it); draft = "" }
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        BasicTextField(
            value = draft,
            onValueChange = { s -> draft = s.filter { it.isDigit() || it == '.' || it == ',' }.take(7) },
            enabled = enabled,
            singleLine = true,
            textStyle = Almanac.type.data.copy(color = c.ink, textAlign = TextAlign.End),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { commit() }),
            modifier = Modifier
                .width(64.dp)
                .clip(CircleShape)
                .border(1.dp, if (value >= habit.target && value > 0) c.moss else c.line, CircleShape)
                .background(c.card)
                .semantics { contentDescription = "${habit.name} amount in ${unit.ifEmpty { "units" }}" },
            decorationBox = { inner ->
                Box(Modifier.size(width = 64.dp, height = 36.dp), contentAlignment = Alignment.CenterEnd) {
                    Box(Modifier.width(52.dp), contentAlignment = Alignment.CenterEnd) {
                        if (draft.isEmpty()) Text(formatAmount(value), style = Almanac.type.data, color = c.faint)
                        inner()
                    }
                }
            },
        )
        Text(unit, style = Almanac.type.caption, color = c.faint)
        Box(
            Modifier.size(32.dp).clip(CircleShape).background(if (draft.isNotEmpty()) c.inverse else c.sunken)
                .clickable(enabled = enabled && draft.isNotEmpty(), role = Role.Button) { commit() }
                .semantics { contentDescription = "Save ${habit.name}" },
            contentAlignment = Alignment.Center,
        ) { AIcon(AlmanacIcon.Check, null, if (draft.isNotEmpty()) c.inverseInk else c.faint, 15.dp) }
    }
}

