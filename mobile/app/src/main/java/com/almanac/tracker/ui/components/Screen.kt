package com.almanac.tracker.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.ui.theme.Almanac

/** Scrollable page with pull-to-refresh and the app's standard 20dp gutters. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RefreshablePage(
    refreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 32.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    PullToRefreshBox(isRefreshing = refreshing, onRefresh = onRefresh, modifier = modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(contentPadding),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            content = content,
        )
    }
}

/** "‹ Back" row used on detail screens. */
@Composable
fun BackBar(label: String, onBack: () -> Unit, modifier: Modifier = Modifier, actions: @Composable () -> Unit = {}) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        TextButton(onClick = onBack) {
            AIcon(AlmanacIcon.Back, null, Almanac.colors.ink, 20.dp)
            Text(label, style = Almanac.type.body.copy(fontWeight = FontWeight.Medium), color = Almanac.colors.ink)
        }
        Spacer(Modifier.weight(1f))
        actions()
    }
}

@Composable
fun PageTitle(title: String, eyebrow: String? = null, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (eyebrow != null) MonoLabel(eyebrow)
        Text(title, style = Almanac.type.display, color = Almanac.colors.ink, modifier = Modifier.semantics { heading() })
        if (subtitle != null) Text(subtitle, style = Almanac.type.small, color = Almanac.colors.muted)
    }
}

/**
 * Renders a [Load]: skeleton while loading, a scoped error with retry when nothing is
 * cached, and content (plus a small notice) when showing cached data.
 */
@Composable
fun <T> LoadContent(
    load: Load<T>,
    onRetry: () -> Unit,
    skeleton: @Composable () -> Unit = { SkeletonCard(4); SkeletonCard(3) },
    errorTitle: String = "This couldn’t load",
    content: @Composable (T) -> Unit,
) {
    when (load) {
        Load.Loading -> skeleton()
        is Load.Failed -> ErrorState(errorTitle, errorBody(load.error), onRetry = if (load.error is AppError.Unauthorized) null else onRetry)
        is Load.Ready -> {
            if (load.error != null && load.stale) {
                StatusBanner(
                    if (load.error is AppError.Offline) "Showing what was saved on this phone. Pull to refresh when you’re back online." else "Couldn’t refresh — showing saved data. ${load.error.message}",
                    if (load.error is AppError.Offline) AlmanacIcon.CloudOff else AlmanacIcon.Alert,
                    inverse = false,
                )
            }
            content(load.data)
        }
    }
}

fun errorBody(error: AppError): String = when (error) {
    is AppError.Offline -> "You’re offline and there’s nothing saved for this screen yet. Connect and pull to refresh."
    else -> "${error.message} Your data is safe."
}
