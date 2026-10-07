package com.almanac.tracker.feature.plan

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
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
import com.almanac.tracker.core.model.TaskRowDto
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.EmptyState
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.PageTitle
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.Segmented
import com.almanac.tracker.ui.theme.Almanac

private val FILTERS = listOf("today" to "Today", "upcoming" to "Upcoming", "someday" to "Someday", "completed" to "Done")

@Composable
fun TasksScreen() {
    val container = LocalAppContainer.current
    val vm = viewModel { TasksViewModel(container) }
    val load by vm.load.collectAsStateWithLifecycle()
    val filter by vm.filter.collectAsStateWithLifecycle()
    val overrides by vm.toggler.overrides.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    var creating by rememberSaveable { mutableStateOf(false) }
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    CollectNotices(vm.notices)
    val tasks = (load as? Load.Ready)?.data?.tasks.orEmpty()

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = vm::refresh) {
        BackBar("Plan", nav::back)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            PageTitle("Tasks")
            Spacer(Modifier.weight(1f))
            AlmanacButton("New", { creating = true }, icon = AlmanacIcon.Plus, small = true)
        }
        Segmented(FILTERS, filter, vm::setFilter)
        LoadContent(load, onRetry = vm::refresh) { data ->
            val groups = PlanLogic.groupTasks(data.tasks.map { t -> overrides[t.id]?.let { vm.toggler.view(t) } ?: t }, filter)
            if (groups.isEmpty()) {
                // "Filter empty" vs "never created" can't be told apart from one filter's result
                // alone, so the copy explains what this view shows and offers to add.
                val (title, body) = when (filter) {
                    "today" -> "Nothing due today." to "Tasks due today or overdue show up here. Enjoy the space — or plan something."
                    "upcoming" -> "Nothing scheduled ahead." to "Give a task a due date to see it here."
                    "someday" -> "No undated tasks." to "Tasks without a due date wait here until you schedule them."
                    else -> "Nothing completed yet." to "Ticked-off tasks appear here, newest first."
                }
                EmptyState(title, body) { AlmanacButton("Add a task", { creating = true }, icon = AlmanacIcon.Plus, small = true) }
            } else {
                groups.forEach { g ->
                    AlmanacCard {
                        if (g.title.isNotEmpty()) MonoLabel("${g.title} · ${g.tasks.size}", if (g.title == "Overdue") Almanac.colors.clay else Almanac.colors.faint)
                        Column {
                            g.tasks.forEachIndexed { i, t ->
                                TaskListItem(t, onToggle = { vm.toggle(t, it) }, onEdit = { editing = t.id })
                                if (i < g.tasks.lastIndex) Divider()
                            }
                        }
                    }
                }
                if (filter == "completed") Text("Showing your most recent completed tasks.", style = Almanac.type.caption, color = Almanac.colors.faint)
            }
        }
    }
    if (creating) TaskEditorSheet(null, onDismiss = { creating = false })
    // If the task vanished (deleted elsewhere), nothing is shown; the stale id is harmless.
    editing?.let { id -> tasks.firstOrNull { it.id == id }?.let { TaskEditorSheet(it, onDismiss = { editing = null }) } }
}

/** TaskRow plus an edit affordance. */
@Composable
internal fun TaskListItem(task: TaskRowDto, onToggle: (Boolean) -> Unit, onEdit: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        TaskRow(task, onToggle, Modifier.weight(1f))
        androidx.compose.material3.IconButton(onClick = onEdit) {
            com.almanac.tracker.ui.components.AIcon(AlmanacIcon.Edit, "Edit ${task.title}", Almanac.colors.faint, 18.dp)
        }
    }
}

