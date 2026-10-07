package com.almanac.tracker.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** Design tokens — mirror the "Tracking" variable collection in Figma and globals.css on the web. */
@Immutable
data class AlmanacColors(
    val page: Color,
    val card: Color,
    val sunken: Color,
    val ink: Color,
    val muted: Color,
    val faint: Color,
    val hair: Color,
    val line: Color,
    val moss: Color,
    val mossSoft: Color,
    val mossOn: Color,
    val ochre: Color,
    val ochreSoft: Color,
    val clay: Color,
    val claySoft: Color,
    val dusk: Color,
    val duskSoft: Color,
    val inverse: Color,
    val inverseInk: Color,
    val isDark: Boolean,
)

val LightColors = AlmanacColors(
    page = Color(0xFFF3F0E8), card = Color(0xFFFBFAF6), sunken = Color(0xFFEAE6DB),
    ink = Color(0xFF1D1C19), muted = Color(0xFF5E5B53), faint = Color(0xFF8F8B80),
    hair = Color(0xFFDFDACD), line = Color(0xFFC6C0B0),
    moss = Color(0xFF2F5D4A), mossSoft = Color(0xFFDCE7DE), mossOn = Color(0xFFFBFAF6),
    ochre = Color(0xFFA8721F), ochreSoft = Color(0xFFF3E6CB),
    clay = Color(0xFFB0533B), claySoft = Color(0xFFF4DED5),
    dusk = Color(0xFF465A8C), duskSoft = Color(0xFFDFE3F0),
    inverse = Color(0xFF1D1C19), inverseInk = Color(0xFFF3F0E8),
    isDark = false,
)

val DarkColors = AlmanacColors(
    page = Color(0xFF121311), card = Color(0xFF1B1C19), sunken = Color(0xFF0C0D0B),
    ink = Color(0xFFF1EEE6), muted = Color(0xFFABA79C), faint = Color(0xFF8A867C),
    hair = Color(0xFF2A2B27), line = Color(0xFF3C3D38),
    moss = Color(0xFF86BF9F), mossSoft = Color(0xFF1D3128), mossOn = Color(0xFF0E1A14),
    ochre = Color(0xFFE3B062), ochreSoft = Color(0xFF382C18),
    clay = Color(0xFFE58D72), claySoft = Color(0xFF3A221B),
    dusk = Color(0xFF9DB0E3), duskSoft = Color(0xFF1E2437),
    inverse = Color(0xFFF1EEE6), inverseInk = Color(0xFF121311),
    isDark = true,
)

val LocalAlmanacColors = staticCompositionLocalOf { LightColors }
