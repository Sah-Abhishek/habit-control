package com.almanac.tracker.feature.common

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.almanac.tracker.ui.theme.Almanac

/** Temporary stand-in while a feature module is being built. */
@Composable
fun Placeholder(title: String) {
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text(title, style = Almanac.type.display, color = Almanac.colors.ink)
    }
}
