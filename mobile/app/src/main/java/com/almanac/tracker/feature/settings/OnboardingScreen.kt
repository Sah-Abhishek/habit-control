package com.almanac.tracker.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.navigation.TodayKey
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.FormError
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.Segmented
import com.almanac.tracker.ui.theme.Almanac

private val GOAL_TYPES = listOf("Exam preparation", "Career", "Fitness", "Learning", "Personal development", "Other")
private val BUILD_SUGGESTIONS = listOf("Study block", "Exercise", "Meditation", "Sleep before 12", "Read 20 pages", "Healthy eating")
private val REDUCE_SUGGESTIONS = listOf("Late-night scrolling", "Smoking", "Alcohol", "Junk food", "Gaming", "Caffeine after 4 pm")

@Composable
fun OnboardingScreen() {
    val container = LocalAppContainer.current
    val vm = viewModel { OnboardingViewModel(container) }
    val s by vm.state.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    val c = Almanac.colors
    LaunchedEffect(s.finished) { if (s.finished) nav.tab(TodayKey) }

    Column(Modifier.fillMaxSize().background(c.page).statusBarsPadding().navigationBarsPadding().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = vm::back, enabled = s.step > 0) { AIcon(AlmanacIcon.Back, "Previous step", if (s.step > 0) c.ink else c.hair) }
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.semantics { contentDescription = "Step ${s.step + 1} of $ONBOARDING_STEPS" }) {
                repeat(ONBOARDING_STEPS) { i ->
                    Box(Modifier.height(8.dp).width(if (i == s.step) 28.dp else 8.dp).clip(CircleShape).background(if (i <= s.step) c.moss else c.line))
                }
            }
            Spacer(Modifier.weight(1f))
            TextButton(onClick = vm::skipAll, enabled = !s.pending) { Text("Skip all", style = Almanac.type.small, color = c.muted) }
        }
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            MonoLabel("Step ${s.step + 1} of $ONBOARDING_STEPS")
            when (s.step) {
                0 -> StepGoals(s, vm)
                1 -> StepBuild(s, vm)
                2 -> StepReduce(s, vm)
                3 -> StepDay(s, vm)
                else -> StepFirstGoal(s, vm)
            }
            FormError(s.error)
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            AlmanacButton("Skip", vm::skip, kind = com.almanac.tracker.ui.components.ButtonKind.Ghost, enabled = !s.pending)
            AlmanacButton(if (s.step == ONBOARDING_STEPS - 1) "Finish" else "Continue", vm::next, pending = s.pending, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun Heading(title: String, body: String) {
    Text(title, style = Almanac.type.display, color = Almanac.colors.ink)
    Text(body, style = Almanac.type.body, color = Almanac.colors.muted)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Chips(options: List<String>, selected: (String) -> Boolean, onToggle: (String) -> Unit) {
    val c = Almanac.colors
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { o ->
            val on = selected(o)
            Text(
                o,
                style = Almanac.type.small.copy(fontWeight = FontWeight.Medium),
                color = if (on) c.inverseInk else c.ink,
                modifier = Modifier
                    .clip(CircleShape)
                    .then(if (on) Modifier.background(c.inverse) else Modifier.border(1.dp, c.line, CircleShape))
                    .toggleable(on, role = Role.Checkbox) { onToggle(o) }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            )
        }
    }
}

@Composable
private fun AddOwn(onAdd: (String) -> Unit) {
    var text by rememberSaveable { mutableStateOf("") }
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LabeledField("Your own", text, { text = it.take(80) }, Modifier.weight(1f), placeholder = "Type a name")
        AlmanacButton("Add", { if (text.isNotBlank()) { onAdd(text.trim()); text = "" } }, kind = com.almanac.tracker.ui.components.ButtonKind.Secondary, small = true, enabled = text.isNotBlank())
    }
}

@Composable
private fun StepGoals(s: OnboardingState, vm: OnboardingViewModel) {
    Heading("What are you working towards?", "Pick any that fit. It just helps us suggest a starting point.")
    Chips(GOAL_TYPES, { it in s.goalTypes }) { o -> vm.update { st -> st.copy(goalTypes = if (o in st.goalTypes) st.goalTypes - o else st.goalTypes + o) } }
}

@Composable
private fun StepBuild(s: OnboardingState, vm: OnboardingViewModel) {
    Heading("Which habits do you want to build?", "Start with one or two you already half-do. Consistency beats ambition.")
    val options = (BUILD_SUGGESTIONS + s.buildHabits).distinct()
    Chips(options, { it in s.buildHabits }) { o -> vm.update { st -> st.copy(buildHabits = if (o in st.buildHabits) st.buildHabits - o else st.buildHabits + o) } }
    AddOwn { name -> vm.update { st -> st.copy(buildHabits = (st.buildHabits + name).distinct()) } }
}

@Composable
private fun StepReduce(s: OnboardingState, vm: OnboardingViewModel) {
    val c = Almanac.colors
    Heading("Anything you’d like to do less of?", "Totally optional. We track trends, not perfection — a slip never wipes your progress.")
    val names = s.reduceHabits.map { it.name }
    Chips((REDUCE_SUGGESTIONS + names).distinct(), { it in names }) { o ->
        vm.update { st -> st.copy(reduceHabits = if (o in names) st.reduceHabits.filterNot { it.name == o } else st.reduceHabits + ReduceItem(o)) }
    }
    AddOwn { name -> vm.update { st -> if (st.reduceHabits.any { it.name == name }) st else st.copy(reduceHabits = st.reduceHabits + ReduceItem(name)) } }
    s.reduceHabits.forEach { item ->
        AlmanacCard {
            Text(item.name, style = Almanac.type.bodyStrong, color = c.ink)
            Segmented(listOf(false to "Cut down", true to "Stop completely"), item.stopCompletely, { stop ->
                vm.update { st -> st.copy(reduceHabits = st.reduceHabits.map { if (it.name == item.name) it.copy(stopCompletely = stop) else it }) }
            })
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Roughly how often per day now?", style = Almanac.type.small, color = c.ink)
                    Text("becomes your baseline", style = Almanac.type.caption, color = c.faint)
                }
                Stepper(item.baseline, label = "${item.name} baseline") { v ->
                    vm.update { st -> st.copy(reduceHabits = st.reduceHabits.map { if (it.name == item.name) it.copy(baseline = v) else it }) }
                }
            }
        }
    }
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.duskSoft).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        AIcon(AlmanacIcon.Lock, null, c.dusk, 16.dp)
        Text("These are marked sensitive and left out of exports unless you include them.", style = Almanac.type.small, color = c.ink)
    }
}

@Composable
private fun Stepper(value: Int, label: String, onChange: (Int) -> Unit) {
    val c = Almanac.colors
    Row(Modifier.clip(RoundedCornerShape(14.dp)).background(c.sunken).padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { onChange((value - 1).coerceAtLeast(1)) }, enabled = value > 1, modifier = Modifier.size(40.dp)) { AIcon(AlmanacIcon.Minus, "Decrease $label", c.ink, 18.dp) }
        Text("$value / day", style = Almanac.type.data, color = c.ink, modifier = Modifier.padding(horizontal = 8.dp))
        IconButton(onClick = { onChange((value + 1).coerceAtMost(99)) }, modifier = Modifier.size(40.dp)) { AIcon(AlmanacIcon.Plus, "Increase $label", c.ink, 18.dp) }
    }
}

@Composable
private fun StepDay(s: OnboardingState, vm: OnboardingViewModel) {
    Heading("What does a typical day allow?", "Set a daily study target you can hit on an ordinary day. You can change it any time in Settings.")
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        LabeledField("Hours", s.targetHours, { v -> vm.update { it.copy(targetHours = v.filter(Char::isDigit).take(2)) } }, Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
        LabeledField("Minutes", s.targetMinutes, { v -> vm.update { it.copy(targetMinutes = v.filter(Char::isDigit).take(2)) } }, Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
    }
    s.fieldErrors["target"]?.let { Text(it, style = Almanac.type.caption, color = Almanac.colors.clay) }
}

@Composable
private fun StepFirstGoal(s: OnboardingState, vm: OnboardingViewModel) {
    Heading("Create your first goal", "Something long-term your daily work adds up to. You’ll add milestones later.")
    LabeledField("Goal", s.goalTitle, { v -> vm.update { it.copy(goalTitle = v.take(120)) } }, placeholder = "e.g. Crack GATE CSE", error = s.fieldErrors["goalTitle"])
    LabeledField(
        "Target date", s.goalTarget, { v -> vm.update { it.copy(goalTarget = v.take(10)) } }, optional = true,
        placeholder = "YYYY-MM-DD", error = s.fieldErrors["goalTarget"], keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
    )
}
