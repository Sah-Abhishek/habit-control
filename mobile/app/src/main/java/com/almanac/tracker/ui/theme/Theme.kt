package com.almanac.tracker.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable

enum class ThemePreference { System, Light, Dark }

@Composable
fun AlmanacTheme(preference: ThemePreference = ThemePreference.System, content: @Composable () -> Unit) {
    val dark = when (preference) {
        ThemePreference.System -> isSystemInDarkTheme()
        ThemePreference.Light -> false
        ThemePreference.Dark -> true
    }
    val c = if (dark) DarkColors else LightColors
    // Material components (dialogs, text fields, sheets) pick up the same palette.
    val scheme = if (dark) {
        darkColorScheme(
            primary = c.moss, onPrimary = c.mossOn, background = c.page, onBackground = c.ink,
            surface = c.card, onSurface = c.ink, surfaceVariant = c.sunken, onSurfaceVariant = c.muted,
            outline = c.line, outlineVariant = c.hair, error = c.clay, secondary = c.ochre, tertiary = c.dusk,
            surfaceContainer = c.card, surfaceContainerHigh = c.card, surfaceContainerLow = c.page,
        )
    } else {
        lightColorScheme(
            primary = c.moss, onPrimary = c.mossOn, background = c.page, onBackground = c.ink,
            surface = c.card, onSurface = c.ink, surfaceVariant = c.sunken, onSurfaceVariant = c.muted,
            outline = c.line, outlineVariant = c.hair, error = c.clay, secondary = c.ochre, tertiary = c.dusk,
            surfaceContainer = c.card, surfaceContainerHigh = c.card, surfaceContainerLow = c.page,
        )
    }
    CompositionLocalProvider(LocalAlmanacColors provides c, LocalAlmanacType provides AlmanacType()) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}

/** Access tokens as `Almanac.colors.moss`, `Almanac.type.title`. */
object Almanac {
    val colors: AlmanacColors
        @Composable @ReadOnlyComposable get() = LocalAlmanacColors.current
    val type: AlmanacType
        @Composable @ReadOnlyComposable get() = LocalAlmanacType.current
}
