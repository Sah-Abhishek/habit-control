package com.almanac.tracker.feature.today

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.FocusDto
import com.almanac.tracker.core.model.TopicOptionsResponse
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.SkeletonBlock
import com.almanac.tracker.ui.theme.Almanac

/** Pick today's one thing: a topic from your plan, or free text. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FocusSheet(current: FocusDto, days: DaysRepository, saving: Boolean, onSave: (topicId: String?, text: String?) -> Unit, onDismiss: () -> Unit) {
    val c = Almanac.colors
    val options by remember { days.topicOptions() }.collectAsState(initial = Load.Loading)
    var query by rememberSaveable { mutableStateOf("") }
    var text by rememberSaveable { mutableStateOf(current.text.orEmpty()) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Today’s one thing", style = Almanac.type.headline, color = c.ink)
            Text("One focus keeps the day simple. It feeds the goal it belongs to.", style = Almanac.type.small, color = c.muted)
            LabeledField("Search topics", query, { query = it.take(60) }, placeholder = "e.g. Transactions")
            when (val o = options) {
                Load.Loading -> repeat(3) { SkeletonBlock(1f, 40) }
                is Load.Failed -> Text("Topics couldn’t load — you can still type a focus below.", style = Almanac.type.small, color = c.muted)
                is Load.Ready<TopicOptionsResponse> -> {
                    val list = o.data.topics.filter { query.isBlank() || it.name.contains(query, true) || it.subjectName.contains(query, true) }.take(30)
                    if (o.data.topics.isEmpty()) Text("No topics yet. Add subjects and topics in Plan, or type a focus below.", style = Almanac.type.small, color = c.muted)
                    list.forEach { t ->
                        val selected = t.id == current.topicId
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(if (selected) c.mossSoft else c.card)
                                .clickable(enabled = !saving, role = Role.Button) { onSave(t.id, null) }
                                .heightIn(min = 52.dp).padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(t.name, style = Almanac.type.bodyStrong, color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(t.subjectName, style = Almanac.type.caption, color = c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            if (selected) AIcon(AlmanacIcon.Check, "Current focus", c.moss, 18.dp)
                        }
                    }
                }
            }
            MonoLabel("Or something else")
            LabeledField("Focus", text, { text = it.take(120) }, placeholder = "e.g. Finish the mock test review")
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                if (current.topicId != null || !current.text.isNullOrBlank()) AlmanacButton("Clear", { onSave(null, null) }, kind = ButtonKind.Ghost)
                AlmanacButton("Set focus", { onSave(null, text) }, enabled = text.isNotBlank(), pending = saving)
            }
        }
    }
}
