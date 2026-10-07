package com.almanac.tracker.feature.habits

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.ui.components.Trail
import com.almanac.tracker.ui.theme.Almanac
import kotlin.math.roundToInt

fun habitMeta(h: HabitSummary): String {
    val r = h.reduction
    if (h.isReduce && r != null) {
        val limit = "Limit ${formatAmount(h.target)}"
        val avg = r.weekAvg ?: return "$limit · just started"
        val change = if (r.prevWeekAvg != null && r.weekChange != null) ", ${if (r.weekChange >= 0) "down" else "up"} from ${formatAmount(round1(r.prevWeekAvg))}" else ""
        return "$limit · 7-day avg ${formatAmount(round1(avg))}$change"
    }
    val c = h.consistency.d30
    if (c.scheduled == 0) return "Starts today"
    val target = if (h.tracking == "binary") "" else " · target ${formatAmount(h.target)} ${h.unit ?: if (h.tracking == "duration") "min" else ""}".trimEnd()
    return "${c.successes} of last ${c.scheduled} days$target"
}

private fun round1(v: Double) = (v * 10).roundToInt() / 10.0

/** Habit row from the Figma "Habit row" component: control · name/meta · 7-day trail. */
@Composable
fun HabitRow(habit: HabitSummary, value: Double, onSet: (Double) -> Unit, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    Row(
        modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (habit.today.scheduled) {
            HabitLogControl(habit, value, onSet)
        } else {
            Box(Modifier.size(38.dp).clip(CircleShape).background(c.sunken), contentAlignment = Alignment.Center) {
                Text("off", style = Almanac.type.caption, color = c.faint)
            }
        }
        Column(Modifier.weight(1f).clickable(onClickLabel = "Open ${habit.name}", onClick = onOpen)) {
            Text(habit.name, style = Almanac.type.bodyStrong, color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(habitMeta(habit), style = Almanac.type.caption, color = c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Trail(habit.trail7, habit.kind)
    }
}
