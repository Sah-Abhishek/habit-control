package com.almanac.tracker.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.almanac.tracker.core.model.GoalDetailResponse
import com.almanac.tracker.core.model.MilestoneDto
import com.almanac.tracker.core.model.TaskInputDto
import com.almanac.tracker.navigation.HabitDetailKey
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.navigation.SubjectKey
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.Pill
import com.almanac.tracker.ui.components.ProgressBar
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.Tone
import com.almanac.tracker.ui.theme.Almanac
import kotlin.math.roundToInt

@Composable
fun GoalDetailScreen(id: String) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "goal-$id") { GoalDetailViewModel(id, container) }
    val load by vm.load.collectAsStateWithLifecycle()
    val gone by vm.gone.collectAsStateWithLifecycle()
    val working by vm.working.collectAsStateWithLifecycle()
    val overrides by vm.toggler.overrides.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    var menu by rememberSaveable { mutableStateOf(false) }
    var editing by rememberSaveable { mutableStateOf(false) }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    var milestoneSheet by rememberSaveable { mutableStateOf<String?>(null) } // id, or "new"
    var addingTask by rememberSaveable { mutableStateOf(false) }
    var editingTask by rememberSaveable { mutableStateOf<String?>(null) }
    CollectNotices(vm.notices)
    LaunchedEffect(gone) { if (gone) nav.back() }
    val data = (load as? Load.Ready)?.data

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = vm::refresh) {
        BackBar("Plan", nav::back) {
            if (data != null) {
                IconButton(onClick = { menu = true }, enabled = !working) { AIcon(AlmanacIcon.More, "Goal actions", Almanac.colors.ink) }
                DropdownMenu(menu, { menu = false }) {
                    val g = data.goal
                    DropdownMenuItem({ Text("Edit") }, { menu = false; editing = true })
                    if (!g.isPrimary && g.status == "active") DropdownMenuItem({ Text("Make main goal") }, { menu = false; vm.makePrimary() })
                    if (g.status == "active") DropdownMenuItem({ Text("Pause") }, { menu = false; vm.setStatus("paused", g.status) })
                    if (g.status != "active") DropdownMenuItem({ Text("Make active") }, { menu = false; vm.setStatus("active", g.status) })
                    if (g.status != "completed") DropdownMenuItem({ Text("Mark completed") }, { menu = false; vm.setStatus("completed", g.status) })
                    if (g.status != "archived") DropdownMenuItem({ Text("Archive") }, { menu = false; vm.setStatus("archived", g.status) })
                    DropdownMenuItem({ Text("Delete…", color = Almanac.colors.clay) }, { menu = false; confirmDelete = true })
                }
            }
        }
        LoadContent(load, onRetry = vm::refresh) { d ->
            GoalDetailContent(
                d, overrides.keys,
                viewTask = { vm.toggler.view(it) },
                onMilestone = { milestoneSheet = it.id },
                onAddMilestone = { milestoneSheet = "new" },
                onToggleTask = vm::toggle,
                onEditTask = { editingTask = it },
                onAddTask = { addingTask = true },
                onSubject = { nav.go(SubjectKey(it)) },
                onHabit = { nav.go(HabitDetailKey(it)) },
            )
        }
    }

    if (data != null) {
        if (editing) GoalEditorSheet(data.goal, null, onDismiss = { editing = false }, save = vm::update)
        milestoneSheet?.let { key ->
            val existing = data.milestones.firstOrNull { it.id == key }
            if (key == "new" || existing != null) {
                MilestoneSheet(
                    existing, onDismiss = { milestoneSheet = null },
                    save = { vm.saveMilestone(existing, it) },
                    onToggleComplete = existing?.let { m -> { done: Boolean -> vm.setMilestoneComplete(m, done) } },
                    onDelete = existing?.let { m -> { vm.deleteMilestone(m) } },
                )
            }
        }
        if (addingTask) TaskEditorSheet(null, onDismiss = { addingTask = false }, defaults = TaskInputDto(title = "", goalId = data.goal.id))
        editingTask?.let { tid -> data.tasks.firstOrNull { it.id == tid }?.let { TaskEditorSheet(it, onDismiss = { editingTask = null }) } }
        if (confirmDelete) DeleteGoalDialog(data.goal.title, onDismiss = { confirmDelete = false }, onConfirm = { confirmDelete = false; vm.delete(data.goal.title) })
    }
}

@Composable
private fun DeleteGoalDialog(title: String, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    var typed by rememberSaveable { mutableStateOf("") }
    val matches = typed.trim() == title.trim()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete this goal?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("This permanently deletes “$title” and its milestones. Linked subjects, habits and tasks are kept but unlinked. Archive instead to keep it.")
                OutlinedTextField(typed, { typed = it }, label = { Text("Type the goal name to confirm") }, singleLine = true)
            }
        },
        confirmButton = { TextButton(onConfirm, enabled = matches) { Text("Delete forever", color = if (matches) Almanac.colors.clay else Almanac.colors.faint) } },
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun GoalDetailContent(
    d: GoalDetailResponse,
    overridden: Set<String>,
    viewTask: (com.almanac.tracker.core.model.TaskRowDto) -> com.almanac.tracker.core.model.TaskRowDto,
    onMilestone: (MilestoneDto) -> Unit,
    onAddMilestone: () -> Unit,
    onToggleTask: (com.almanac.tracker.core.model.TaskRowDto, Boolean) -> Unit,
    onEditTask: (String) -> Unit,
    onAddTask: () -> Unit,
    onSubject: (String) -> Unit,
    onHabit: (String) -> Unit,
) {
    val c = Almanac.colors
    val g = d.goal
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (g.isPrimary) Pill("Main goal", Tone.Moss)
            if (g.status != "active") Pill(g.status.replaceFirstChar { it.uppercase() })
        }
        Text(g.title, style = Almanac.type.display, color = c.ink)
        val sub = listOfNotNull(g.targetDate?.let { "Target ${PlanLogic.formatDate(it)}" }, PlanLogic.daysLeftText(g.daysLeft)).joinToString(" · ")
        if (sub.isNotEmpty()) Text(sub, style = Almanac.type.small, color = c.muted)
        g.description?.takeIf { it.isNotBlank() }?.let { Text(it, style = Almanac.type.small, color = c.muted) }
    }

    AlmanacCard {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(PlanLogic.percent(g.progress), style = Almanac.type.bigNumber, color = c.ink)
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                PacePill(g.pace)
                g.expected?.let { Text("plan says ${PlanLogic.percent(it)} by today", style = Almanac.type.caption, color = c.muted) }
            }
        }
        PaceBar(g.progress, g.expected)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Metric("Velocity", d.velocityPerWeek?.let { "+${fmt1(it * 100)}% / wk" } ?: "—", Modifier.weight(1f))
            Metric("Needed", d.neededPerWeek?.let { "+${fmt1(it * 100)}% / wk" } ?: "—", Modifier.weight(1f))
            Metric("Est. finish", g.estFinish?.let { PlanLogic.formatDate(it) } ?: "—", Modifier.weight(1f), highlight = g.pace != "behind")
        }
        Text("Estimates extrapolate your progress so far in a straight line.", style = Almanac.type.caption, color = c.faint)
    }

    AlmanacCard {
        SectionHeader("The route", meta = "${d.milestones.size} milestones", metaColor = c.faint)
        if (d.milestones.isEmpty()) {
            Text("Break the goal into a few milestones — progress is the average of their progress.", style = Almanac.type.small, color = c.muted)
        } else {
            VerticalRoute(d.milestones.sortedBy { it.position }, onMilestone)
        }
        AlmanacButton("Add milestone", onAddMilestone, kind = ButtonKind.Secondary, icon = AlmanacIcon.Plus, small = true)
    }

    if (d.subjects.isNotEmpty()) {
        AlmanacCard {
            SectionHeader("Study areas")
            d.subjects.forEach { s ->
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = { onSubject(s.id) }, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                            Text(s.name, style = Almanac.type.bodyStrong, color = c.ink)
                        }
                        Spacer(Modifier.weight(1f))
                        Text(PlanLogic.percent(s.progress), style = Almanac.type.data.copy(fontSize = Almanac.type.small.fontSize), color = c.muted)
                    }
                    ProgressBar(s.progress.toFloat(), color = if (s.progress < 0.4) c.ochre else c.moss, label = "${s.name} progress")
                }
            }
        }
    }

    if (d.habits.isNotEmpty()) {
        AlmanacCard {
            SectionHeader("Linked habits")
            d.habits.forEach { h ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { onHabit(h.id) }, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                        Text(h.name, style = Almanac.type.body, color = c.ink)
                    }
                    Spacer(Modifier.weight(1f))
                    Text(h.rate30?.let { "${PlanLogic.percent(it)} · 30 days" } ?: "new", style = Almanac.type.caption, color = c.muted)
                }
            }
        }
    }

    AlmanacCard {
        SectionHeader("Tasks", meta = d.tasks.count { !it.done }.takeIf { it > 0 }?.let { "$it open" }, action = {
            AlmanacButton("Add", onAddTask, kind = ButtonKind.Ghost, icon = AlmanacIcon.Plus, small = true)
        })
        if (d.tasks.isEmpty()) {
            Text("No tasks linked to this goal yet.", style = Almanac.type.small, color = c.muted)
        } else {
            val tasks = PlanLogic.sortTasks(d.tasks.map { if (it.id in overridden) viewTask(it) else it })
            tasks.forEachIndexed { i, t ->
                TaskListItem(t, onToggle = { onToggleTask(t, it) }, onEdit = { onEditTask(t.id) })
                if (i < tasks.lastIndex) Divider()
            }
        }
    }
}

private fun fmt1(v: Double) = ((v * 10).roundToInt() / 10.0).let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() }

@Composable
private fun Metric(label: String, value: String, modifier: Modifier = Modifier, highlight: Boolean = false) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        MonoLabel(label)
        Text(value, style = Almanac.type.data.copy(fontSize = Almanac.type.small.fontSize), color = if (highlight && value != "—") Almanac.colors.moss else Almanac.colors.ink)
    }
}
