package com.almanac.tracker.feature.habits

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.navigation.HabitDetailKey
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.EmptyState
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.PageTitle
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SectionHeader
import androidx.compose.material3.Text
import com.almanac.tracker.ui.theme.Almanac

@Composable
fun HabitsScreen() {
    val container = LocalAppContainer.current
    val vm = viewModel { HabitsViewModel(container) }
    val load by vm.load.collectAsStateWithLifecycle()
    val overrides by vm.logger.overrides.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    var creating by rememberSaveable { mutableStateOf(false) }
    CollectNotices(vm.notices)

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = { vm.refresh() }) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            PageTitle("Habits", eyebrow = (load as? Load.Ready)?.data?.today?.let { "Today · $it" })
            androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
            AlmanacButton("New", { creating = true }, icon = AlmanacIcon.Plus, small = true)
        }
        LoadContent(load, onRetry = { vm.refresh() }) { data ->
            if (data.habits.isEmpty()) {
                EmptyState(
                    "You haven’t created any habits yet.",
                    "Start with one or two you already half-do — consistency beats ambition. You can also track something you want to do less of.",
                ) { AlmanacButton("Create your first habit", { creating = true }, icon = AlmanacIcon.Plus) }
            } else {
                val today = data.today
                val build = data.habits.filter { !it.isReduce }
                val reduce = data.habits.filter { it.isReduce }
                val onTrack = data.habits.count { it.today.scheduled && it.today.state in setOf("done", "clear", "within") }
                Text(
                    "$onTrack of ${data.habits.count { it.today.scheduled }} on track today. A missed day is a gap in the thread, not a reset.",
                    style = Almanac.type.small, color = Almanac.colors.muted,
                )
                HabitGroup("Building", build, today, overrides, vm, onOpen = { nav.go(HabitDetailKey(it)) }, empty = "No habits to build yet.")
                HabitGroup("Doing less of", reduce, today, overrides, vm, onOpen = { nav.go(HabitDetailKey(it)) }, empty = "Add a “do less of” habit to track it against your own baseline — lapses never wipe your progress.")
                if (data.archived.isNotEmpty()) {
                    SectionHeader("Archived", meta = "history kept", metaColor = Almanac.colors.faint)
                    data.archived.forEach { a ->
                        AlmanacButton(a.name, { nav.go(HabitDetailKey(a.id)) }, kind = com.almanac.tracker.ui.components.ButtonKind.Secondary, small = true)
                    }
                }
            }
        }
    }
    if (creating) HabitEditorSheet(null, onDismiss = { creating = false }, save = { vm.save(null, it) })
}

@Composable
private fun HabitGroup(title: String, habits: List<HabitSummary>, today: String, overrides: Map<String, Double>, vm: HabitsViewModel, onOpen: (String) -> Unit, empty: String) {
    AlmanacCard {
        SectionHeader(title, meta = "${habits.size}")
        if (habits.isEmpty()) {
            Text(empty, style = Almanac.type.small, color = Almanac.colors.muted)
        } else {
            androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                habits.forEachIndexed { i, h ->
                    val value = overrides["${h.id}@$today"] ?: h.today.value
                    HabitRow(h, value, onSet = { vm.log(h, today, it) }, onOpen = { onOpen(h.id) })
                    if (i < habits.lastIndex) Divider()
                }
            }
        }
    }
}
