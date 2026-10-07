package com.almanac.tracker.feature.plan

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.GoalCardDto
import com.almanac.tracker.feature.study.RevisionsDueList
import com.almanac.tracker.feature.study.StartSessionButton
import com.almanac.tracker.feature.study.SubjectEditorSheet
import com.almanac.tracker.feature.study.SubjectsSection
import com.almanac.tracker.navigation.GoalDetailKey
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.navigation.SubjectKey
import com.almanac.tracker.navigation.TasksKey
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.EmptyState
import com.almanac.tracker.ui.components.ErrorState
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.PageTitle
import com.almanac.tracker.ui.components.ProgressBar
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.SkeletonCard
import com.almanac.tracker.ui.components.errorBody
import com.almanac.tracker.ui.theme.Almanac

/** Plan tab: goals (the long-term tree) + study (what hangs off it) + tasks. */
@Composable
fun PlanScreen() {
    val container = LocalAppContainer.current
    val vm = viewModel { PlanViewModel(container) }
    val goals by vm.goalsLoad.collectAsStateWithLifecycle()
    val tasks by vm.tasksLoad.collectAsStateWithLifecycle()
    val study by vm.studyLoad.collectAsStateWithLifecycle()
    val overrides by vm.toggler.overrides.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    var newGoal by rememberSaveable { mutableStateOf(false) }
    var newSubject by rememberSaveable { mutableStateOf(false) }
    var newTask by rememberSaveable { mutableStateOf(false) }
    CollectNotices(vm.notices)
    val refreshing = listOf(goals, tasks, study).any { (it as? Load.Ready)?.refreshing == true }

    RefreshablePage(refreshing = refreshing, onRefresh = vm::refresh) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            PageTitle("Plan", subtitle = "Goals, what you study for them, and what’s next.")
            Spacer(Modifier.weight(1f))
            AlmanacButton("Goal", { newGoal = true }, icon = AlmanacIcon.Plus, small = true)
        }

        // Goals
        LoadContent(goals, onRetry = vm::refresh, errorTitle = "Goals couldn’t load") { data ->
            val active = data.goals.filter { it.status == "active" || it.status == "paused" }
            val main = active.firstOrNull { it.isPrimary } ?: active.firstOrNull()
            if (main == null) {
                EmptyState(
                    if (data.goals.isEmpty()) "No goals yet." else "No active goals.",
                    "A goal ties your daily work together — e.g. “Crack GATE CSE by Feb 2027”. Add milestones, then link subjects and habits.",
                ) { AlmanacButton("Set your first goal", { newGoal = true }, icon = AlmanacIcon.Plus) }
            } else {
                MainGoalHero(main) { nav.go(GoalDetailKey(main.id)) }
                val others = data.goals.filter { it.id != main.id }
                if (others.isNotEmpty()) {
                    AlmanacCard {
                        SectionHeader("Other goals", meta = "${others.size}", metaColor = Almanac.colors.faint)
                        others.forEachIndexed { i, g ->
                            GoalRow(g) { nav.go(GoalDetailKey(g.id)) }
                            if (i < others.lastIndex) Divider()
                        }
                    }
                }
            }
        }

        // Study
        when (val s = study) {
            Load.Loading -> SkeletonCard(3)
            is Load.Failed -> ErrorState("Study couldn’t load", errorBody(s.error), onRetry = vm::refresh)
            is Load.Ready -> {
                val d = s.data
                AlmanacCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            MonoLabel("Study today")
                            Text(
                                "${formatMinutes(d.todaySeconds)}" + if (d.targetSeconds > 0) " of ${formatMinutes(d.targetSeconds)}" else "",
                                style = Almanac.type.title, color = Almanac.colors.ink,
                            )
                        }
                        StartSessionButton(null, null, label = if (d.running != null) "Open timer" else "Start session", small = true)
                    }
                    if (d.targetSeconds > 0) ProgressBar((d.todaySeconds.toFloat() / d.targetSeconds).coerceIn(0f, 1f), color = Almanac.colors.ochre, label = "Study today")
                }
                SubjectsSection(d.subjects, onOpen = { nav.go(SubjectKey(it)) }, onAdd = { newSubject = true })
                if (d.revisionsDue.isNotEmpty()) RevisionsDueList(d.revisionsDue, onOpenSubject = { nav.go(SubjectKey(it)) })
            }
        }

        // Tasks preview
        AlmanacCard {
            SectionHeader("Today’s tasks", action = {
                AlmanacButton("All", { nav.go(TasksKey) }, kind = ButtonKind.Ghost, small = true)
                AlmanacButton("Add", { newTask = true }, kind = ButtonKind.Ghost, icon = AlmanacIcon.Plus, small = true)
            })
            when (val t = tasks) {
                Load.Loading -> Text("Loading…", style = Almanac.type.small, color = Almanac.colors.faint)
                is Load.Failed -> Text(errorBody(t.error), style = Almanac.type.small, color = Almanac.colors.muted)
                is Load.Ready -> {
                    val list = PlanLogic.sortTasks(t.data.tasks.map { if (it.id in overrides) vm.toggler.view(it) else it }).take(6)
                    if (list.isEmpty()) {
                        Text("Nothing due today. Tasks with today’s date or overdue show up here.", style = Almanac.type.small, color = Almanac.colors.muted)
                    } else {
                        list.forEachIndexed { i, task ->
                            TaskRow(task, onToggle = { vm.toggle(task, it) })
                            if (i < list.lastIndex) Divider()
                        }
                        if (t.data.tasks.size > list.size) {
                            Text("+${t.data.tasks.size - list.size} more", style = Almanac.type.caption, color = Almanac.colors.moss,
                                modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { nav.go(TasksKey) }.padding(4.dp))
                        }
                    }
                }
            }
        }
    }

    if (newGoal) GoalEditorSheet(null, null, onDismiss = { newGoal = false }, save = vm::createGoal)
    if (newSubject) SubjectEditorSheet(null, onDismiss = { newSubject = false })
    if (newTask) TaskEditorSheet(null, onDismiss = { newTask = false })
}

private fun formatMinutes(seconds: Long): String {
    val m = (seconds / 60).coerceAtLeast(0)
    return when {
        m < 60 -> "${m}m"
        m % 60 == 0L -> "${m / 60}h"
        else -> "${m / 60}h ${m % 60}m"
    }
}

@Composable
private fun MainGoalHero(g: GoalCardDto, onOpen: () -> Unit) {
    val c = Almanac.colors
    AlmanacCard(Modifier.clip(RoundedCornerShape(22.dp)).clickable(onClickLabel = "Open ${g.title}", onClick = onOpen)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MonoLabel(if (g.isPrimary) "Main goal" else "Goal")
            Spacer(Modifier.weight(1f))
            PacePill(g.pace)
        }
        Row(verticalAlignment = Alignment.Bottom) {
            Text(g.title, style = Almanac.type.headline, color = c.ink, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(PlanLogic.percent(g.progress), style = Almanac.type.dataLarge, color = c.ink)
        }
        if (g.milestoneCount > 0) {
            HorizontalRoute(
                List(g.milestoneCount) { i -> (i < g.completedMilestones) to 0 },
                g.progress,
            )
        } else {
            PaceBar(g.progress, g.expected)
        }
        val line = listOfNotNull(
            PlanLogic.daysLeftText(g.daysLeft),
            g.expected?.let { "plan says ${PlanLogic.percent(it)} today" },
            g.estFinish?.let { "est. finish ${PlanLogic.formatDate(it)}" },
        ).joinToString(" · ")
        if (line.isNotEmpty()) Text(line, style = Almanac.type.caption, color = c.muted)
        if (g.status == "paused") Text("Paused — not counted on Today.", style = Almanac.type.caption, color = c.faint)
    }
}

@Composable
private fun GoalRow(g: GoalCardDto, onOpen: () -> Unit) {
    val c = Almanac.colors
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClickLabel = "Open ${g.title}", onClick = onOpen).padding(vertical = 10.dp)
            .semantics(mergeDescendants = true) { contentDescription = "${g.title}, ${PlanLogic.percent(g.progress)}, ${PlanLogic.paceLabel(g.pace) ?: g.status}" },
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(g.title, style = Almanac.type.bodyStrong, color = c.ink, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (g.status != "active") Text(g.status.replaceFirstChar { it.uppercase() }, style = Almanac.type.caption, color = c.faint) else PacePill(g.pace)
            Text(PlanLogic.percent(g.progress), style = Almanac.type.data.copy(fontSize = Almanac.type.small.fontSize), color = c.muted)
        }
        ProgressBar(g.progress.toFloat(), color = if (g.pace == "behind") c.ochre else c.moss)
        PlanLogic.daysLeftText(g.daysLeft)?.let { Text(it, style = Almanac.type.caption, color = c.faint) }
    }
}
