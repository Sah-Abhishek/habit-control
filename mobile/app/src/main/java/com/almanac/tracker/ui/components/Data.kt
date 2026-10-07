package com.almanac.tracker.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.Tick
import com.almanac.tracker.ui.theme.Almanac

/** The "thread": one tick per day. A gap is a missed day; the thread keeps going. */
@Composable
fun Trail(ticks: List<Tick>, kind: String, modifier: Modifier = Modifier, tickWidth: Int = 4, gap: Int = 3, maxHeight: Int = 14) {
    val c = Almanac.colors
    val counted = ticks.filter { it.state != "off" && it.state != "future" }
    val good = counted.count { it.state in setOf("done", "clear", "within") }
    Row(
        modifier.height(maxHeight.dp).semantics { contentDescription = "$good of ${counted.size} scheduled days on track" },
        horizontalArrangement = Arrangement.spacedBy(gap.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        for (t in ticks) {
            val (h, color) = when (t.state) {
                "done", "clear" -> maxHeight to c.moss
                "within", "partial" -> (maxHeight * 0.65f).toInt() to c.moss.copy(alpha = 0.5f)
                "over" -> maxHeight to c.clay
                "off", "future" -> 4 to c.hair
                else -> 4 to c.line
            }
            Box(Modifier.width(tickWidth.dp).height(h.dp).clip(CircleShape).background(color))
        }
    }
}

/** One-tap 1–10 scale (mood / energy / stress). Tapping the selected value clears it. */
@Composable
fun ScaleRow(label: String, value: Int?, onSelect: (Int?) -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val c = Almanac.colors
    Row(modifier.fillMaxWidth().selectableGroup(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        for (i in 1..10) {
            val on = i == value
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = 40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (on) c.inverse else c.sunken)
                    .selectable(selected = on, enabled = enabled, role = Role.RadioButton, onClick = { onSelect(if (on) null else i) })
                    .semantics { contentDescription = "$label $i of 10" },
                contentAlignment = Alignment.Center,
            ) {
                Text("$i", style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = if (on) c.inverseInk else c.muted)
            }
        }
    }
}

@Composable
fun <T> Segmented(options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    Row(
        modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.sunken).padding(4.dp).selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        for ((value, label) in options) {
            val on = value == selected
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = 40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (on) c.card else Color.Transparent)
                    .selectable(selected = on, role = Role.Tab, onClick = { onSelect(value) }),
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = Almanac.type.small.copy(fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium), color = if (on) c.ink else c.muted, maxLines = 1)
            }
        }
    }
}

/** Banner for offline mode, pending sync and refresh errors on top of cached data. */
@Composable
fun StatusBanner(text: String, icon: AlmanacIcon, modifier: Modifier = Modifier, inverse: Boolean = true, action: Pair<String, () -> Unit>? = null) {
    val c = Almanac.colors
    val bg = if (inverse) c.inverse else c.sunken
    val fg = if (inverse) c.inverseInk else c.ink
    Row(
        modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(bg).padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        AIcon(icon, null, fg, 16.dp)
        Text(text, style = Almanac.type.small, color = fg, modifier = Modifier.weight(1f))
        if (action != null) {
            Text(
                action.first,
                style = Almanac.type.small.copy(fontWeight = FontWeight.Bold),
                color = c.ochre,
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).selectable(selected = false, role = Role.Button, onClick = action.second).padding(4.dp),
            )
        }
    }
}
