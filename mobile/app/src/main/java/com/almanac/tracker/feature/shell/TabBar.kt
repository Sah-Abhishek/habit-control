package com.almanac.tracker.feature.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation3.runtime.NavKey
import com.almanac.tracker.navigation.HabitsKey
import com.almanac.tracker.navigation.InsightsKey
import com.almanac.tracker.navigation.PlanKey
import com.almanac.tracker.navigation.TodayKey
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.theme.Almanac

/** Today · Plan · (+) · Habits · Insights — from the Figma mobile tab bar. */
@Composable
fun TabBar(current: NavKey, onTab: (NavKey) -> Unit, onQuickLog: () -> Unit) {
    val c = Almanac.colors
    Column(Modifier.fillMaxWidth().background(c.card)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(c.hair))
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp).selectableGroup(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TabItem("Today", AlmanacIcon.Today, current == TodayKey) { onTab(TodayKey) }
            TabItem("Plan", AlmanacIcon.Plan, current == PlanKey) { onTab(PlanKey) }
            Surface(
                onClick = onQuickLog,
                shape = RoundedCornerShape(20.dp),
                color = c.inverse,
                modifier = Modifier.width(60.dp).height(46.dp).semantics { contentDescription = "Log something" },
            ) {
                Box(contentAlignment = Alignment.Center) { AIcon(AlmanacIcon.Plus, null, c.inverseInk, 24.dp) }
            }
            TabItem("Habits", AlmanacIcon.Habits, current == HabitsKey) { onTab(HabitsKey) }
            TabItem("Insights", AlmanacIcon.Insights, current == InsightsKey) { onTab(InsightsKey) }
        }
    }
}

@Composable
private fun TabItem(label: String, icon: AlmanacIcon, selected: Boolean, onClick: () -> Unit) {
    val c = Almanac.colors
    val color = if (selected) c.moss else c.faint
    Column(
        Modifier
            .width(64.dp)
            .clip(RoundedCornerShape(12.dp))
            .selectable(selected = selected, role = Role.Tab, onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        AIcon(icon, null, color, 22.dp)
        Text(label, fontSize = 11.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium, color = color, style = Almanac.type.caption)
    }
}

