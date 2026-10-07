package com.almanac.tracker.feature.plan

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.GoalCardDto
import com.almanac.tracker.core.model.GoalInputDto
import com.almanac.tracker.core.model.MilestoneDto
import com.almanac.tracker.core.model.MilestoneInputDto
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.FormError
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.theme.Almanac
import kotlinx.coroutines.launch
import java.time.LocalDate
import kotlin.math.roundToInt

/** Create / edit a goal. [save] returns field errors; empty = saved. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoalEditorSheet(existing: GoalCardDto?, today: String?, onDismiss: () -> Unit, save: suspend (GoalInputDto) -> Map<String, String>) {
    val c = Almanac.colors
    val scope = rememberCoroutineScope()
    var title by rememberSaveable { mutableStateOf(existing?.title ?: "") }
    var description by rememberSaveable { mutableStateOf(existing?.description ?: "") }
    var start by rememberSaveable { mutableStateOf(existing?.startDate ?: today ?: LocalDate.now().toString()) }
    var target by rememberSaveable { mutableStateOf(existing?.targetDate) }
    var primary by rememberSaveable { mutableStateOf(existing?.isPrimary ?: false) }
    var errors by rememberSaveable { mutableStateOf(mapOf<String, String>()) }
    var pending by rememberSaveable { mutableStateOf(false) }

    fun submit() {
        if (pending) return
        val local = PlanLogic.validateGoal(title, start, target)
        errors = local
        if (local.isNotEmpty()) return
        pending = true
        scope.launch {
            val result = save(
                GoalInputDto(
                    title = title.trim(), description = description.trim().ifEmpty { null }, startDate = start, targetDate = target,
                    // Only send isPrimary when turning it on; un-setting happens by choosing another main goal.
                    isPrimary = if (primary && existing?.isPrimary != true) true else null,
                ),
            )
            pending = false
            if (result.isEmpty()) onDismiss() else errors = result.mapKeys { it.key.removePrefix("data.") }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(if (existing == null) "New goal" else "Edit goal", style = Almanac.type.headline, color = c.ink)
            Text("A long-term outcome. Break it into milestones, then link subjects, habits and tasks.", style = Almanac.type.small, color = c.muted)
            FormError(errors["_form"])
            LabeledField("Goal", title, { title = it.take(120) }, error = errors["title"], placeholder = "e.g. Crack GATE CSE")
            LabeledField("Why it matters", description, { description = it.take(1000) }, optional = true, singleLine = false, minLines = 2, error = errors["description"])
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                DateField("Start", start, { if (it != null) start = it }, error = errors["startDate"], modifier = Modifier.weight(1f))
                DateField("Target", target, { target = it }, optional = true, error = errors["targetDate"], modifier = Modifier.weight(1f))
            }
            if (existing?.isPrimary != true) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.mossSoft)
                        .toggleable(primary, role = Role.Checkbox) { primary = it }.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(primary, null, colors = CheckboxDefaults.colors(checkedColor = c.moss))
                    Text("Make this my main goal — it’s shown on Today.", style = Almanac.type.small, color = c.ink)
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                AlmanacButton("Cancel", onDismiss, kind = ButtonKind.Ghost)
                AlmanacButton(if (existing == null) "Add goal" else "Save", ::submit, pending = pending)
            }
        }
    }
}

/** Add / edit a milestone: title, target date, progress slider, complete toggle, delete. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MilestoneSheet(
    existing: MilestoneDto?,
    onDismiss: () -> Unit,
    save: suspend (MilestoneInputDto) -> Map<String, String>,
    onToggleComplete: ((Boolean) -> Unit)? = null,
    onDelete: (() -> Unit)? = null,
) {
    val c = Almanac.colors
    val scope = rememberCoroutineScope()
    var title by rememberSaveable { mutableStateOf(existing?.title ?: "") }
    var target by rememberSaveable { mutableStateOf(existing?.targetDate) }
    var progress by rememberSaveable { mutableIntStateOf(existing?.progress ?: 0) }
    var errors by rememberSaveable { mutableStateOf(mapOf<String, String>()) }
    var pending by rememberSaveable { mutableStateOf(false) }

    fun submit() {
        if (pending) return
        val local = PlanLogic.validateMilestone(title, progress)
        errors = local
        if (local.isNotEmpty()) return
        pending = true
        scope.launch {
            val result = save(MilestoneInputDto(title.trim(), target, progress))
            pending = false
            if (result.isEmpty()) onDismiss() else errors = result.mapKeys { it.key.removePrefix("data.") }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(if (existing == null) "New milestone" else "Milestone", style = Almanac.type.headline, color = c.ink)
            FormError(errors["_form"])
            LabeledField("Milestone", title, { title = it.take(120) }, error = errors["title"], placeholder = "e.g. Complete syllabus")
            DateField("Target date", target, { target = it }, optional = true, error = errors["targetDate"])
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Progress", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.ink)
                Spacer(Modifier.weight(1f))
                Text("$progress%", style = Almanac.type.data, color = c.moss)
            }
            Slider(
                value = progress.toFloat(),
                onValueChange = { progress = (it / 5f).roundToInt() * 5 },
                valueRange = 0f..100f,
                steps = 19,
                colors = SliderDefaults.colors(thumbColor = c.moss, activeTrackColor = c.moss, inactiveTrackColor = c.sunken),
                modifier = Modifier.semantics { contentDescription = "Milestone progress"; stateDescription = "$progress percent" },
            )
            if (existing != null && onToggleComplete != null) {
                AlmanacButton(
                    if (existing.completed) "Mark as not done" else "Mark complete",
                    { onToggleComplete(!existing.completed); onDismiss() },
                    kind = ButtonKind.Secondary, icon = AlmanacIcon.Check, modifier = Modifier.fillMaxWidth(),
                )
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (existing != null && onDelete != null) AlmanacButton("Delete", { onDelete(); onDismiss() }, kind = ButtonKind.Ghost, icon = AlmanacIcon.Trash)
                Spacer(Modifier.weight(1f))
                AlmanacButton("Cancel", onDismiss, kind = ButtonKind.Ghost)
                AlmanacButton(if (existing == null) "Add" else "Save", ::submit, pending = pending)
            }
        }
    }
}
