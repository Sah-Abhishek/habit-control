package com.almanac.tracker.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.ui.theme.Almanac

@Composable
fun AlmanacCard(
    modifier: Modifier = Modifier,
    color: Color = Almanac.colors.card,
    padding: PaddingValues = PaddingValues(18.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(color)
            .padding(padding),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

/** Mono, uppercase, tracked — the "eyebrow" label from the designs. */
@Composable
fun MonoLabel(text: String, color: Color = Almanac.colors.faint, modifier: Modifier = Modifier) {
    Text(text.uppercase(), style = Almanac.type.label, color = color, modifier = modifier, maxLines = 1, overflow = TextOverflow.Ellipsis)
}

@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier, meta: String? = null, metaColor: Color = Almanac.colors.moss, action: (@Composable RowScope.() -> Unit)? = null) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = Almanac.type.title, color = Almanac.colors.ink, modifier = Modifier.semantics { heading() })
        if (meta != null) Text(meta, style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = metaColor)
        Spacer(Modifier.weight(1f))
        action?.invoke(this)
    }
}

enum class Tone { Moss, Ochre, Clay, Dusk, Neutral }

@Composable
fun toneColors(tone: Tone): Pair<Color, Color> {
    val c = Almanac.colors
    return when (tone) {
        Tone.Moss -> c.mossSoft to c.moss
        Tone.Ochre -> c.ochreSoft to c.ochre
        Tone.Clay -> c.claySoft to c.clay
        Tone.Dusk -> c.duskSoft to c.dusk
        Tone.Neutral -> c.sunken to c.muted
    }
}

@Composable
fun Pill(text: String, tone: Tone = Tone.Neutral, modifier: Modifier = Modifier) {
    val (bg, fg) = toneColors(tone)
    Text(
        text,
        style = Almanac.type.caption.copy(fontWeight = FontWeight.SemiBold),
        color = fg,
        modifier = modifier.clip(CircleShape).background(bg).padding(horizontal = 10.dp, vertical = 3.dp),
        maxLines = 1,
    )
}

@Composable
fun ProgressBar(value: Float, modifier: Modifier = Modifier, color: Color = Almanac.colors.moss, height: Int = 6, label: String? = null) {
    val v = value.coerceIn(0f, 1f).takeIf { !it.isNaN() } ?: 0f
    Box(
        modifier
            .fillMaxWidth()
            .height(height.dp)
            .clip(CircleShape)
            .background(Almanac.colors.sunken)
            .semantics {
                progressBarRangeInfo = ProgressBarRangeInfo(v, 0f..1f)
                if (label != null) this.contentDescription = label
            },
    ) {
        Box(Modifier.fillMaxWidth(v).height(height.dp).clip(CircleShape).background(color))
    }
}

enum class ButtonKind { Primary, Accent, Secondary, Ghost, Danger }

@Composable
fun AlmanacButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Primary,
    icon: AlmanacIcon? = null,
    pending: Boolean = false,
    enabled: Boolean = true,
    small: Boolean = false,
) {
    val c = Almanac.colors
    val (bg, fg, border) = when (kind) {
        ButtonKind.Primary -> Triple(c.inverse, c.inverseInk, null)
        ButtonKind.Accent -> Triple(c.moss, c.mossOn, null)
        ButtonKind.Secondary -> Triple(Color.Transparent, c.ink, c.line)
        ButtonKind.Ghost -> Triple(Color.Transparent, c.muted, null)
        ButtonKind.Danger -> Triple(c.clay, c.card, null)
    }
    val active = enabled && !pending
    Surface(
        onClick = onClick,
        enabled = active,
        shape = RoundedCornerShape(if (small) 12.dp else 16.dp),
        color = bg,
        contentColor = fg,
        border = border?.let { androidx.compose.foundation.BorderStroke(1.dp, it) },
        modifier = modifier
            .heightIn(min = if (small) 40.dp else 48.dp)
            .semantics { role = Role.Button },
    ) {
        Row(
            Modifier.padding(horizontal = if (small) 14.dp else 18.dp, vertical = if (small) 8.dp else 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (pending) {
                CircularProgressIndicator(Modifier.size(16.dp), color = fg, strokeWidth = 2.dp)
            } else if (icon != null) {
                AIcon(icon, null, fg, if (small) 16.dp else 18.dp)
            }
            Text(text, style = if (small) Almanac.type.button.copy(fontSize = Almanac.type.small.fontSize) else Almanac.type.button, color = if (active) fg else fg.copy(alpha = 0.5f), maxLines = 1)
        }
    }
}

@Composable
fun Divider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(Almanac.colors.hair))
}

@Composable
fun Dot(color: Color, size: Int = 8, modifier: Modifier = Modifier) {
    Box(modifier.size(size.dp).clip(CircleShape).background(color))
}

@Composable
fun HSpace(w: Int) = Spacer(Modifier.width(w.dp))

@Composable
fun VSpace(h: Int) = Spacer(Modifier.height(h.dp))

/** Outlined, dashed-feeling container for "nothing here yet" states. */
@Composable
fun EmptyState(title: String, body: String? = null, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .border(1.dp, Almanac.colors.line, RoundedCornerShape(18.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, style = Almanac.type.bodyStrong, color = Almanac.colors.ink)
        if (body != null) Text(body, style = Almanac.type.small, color = Almanac.colors.muted)
        action?.invoke()
    }
}

@Composable
fun ErrorState(title: String, body: String, modifier: Modifier = Modifier, onRetry: (() -> Unit)? = null) {
    AlmanacCard(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(32.dp).clip(RoundedCornerShape(10.dp)).background(Almanac.colors.claySoft), contentAlignment = Alignment.Center) {
                AIcon(AlmanacIcon.Alert, null, Almanac.colors.clay, 16.dp)
            }
            Text(title, style = Almanac.type.bodyStrong, color = Almanac.colors.ink)
        }
        Text(body, style = Almanac.type.small, color = Almanac.colors.muted)
        if (onRetry != null) AlmanacButton("Try again", onRetry, kind = ButtonKind.Secondary, icon = AlmanacIcon.Refresh, small = true)
    }
}

@Composable
fun SkeletonBlock(width: Float = 1f, height: Int = 12, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth(width).height(height.dp).clip(CircleShape).background(Almanac.colors.sunken))
}

@Composable
fun SkeletonCard(lines: Int = 3, modifier: Modifier = Modifier) {
    AlmanacCard(modifier) {
        SkeletonBlock(0.3f, 10)
        SkeletonBlock(0.6f, 22)
        repeat(lines) { SkeletonBlock(1f, 10) }
    }
}
