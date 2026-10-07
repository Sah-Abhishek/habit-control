package com.almanac.tracker.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.almanac.tracker.R

val SerifFamily = FontFamily(
    Font(R.font.instrument_serif, FontWeight.Normal),
    Font(R.font.instrument_serif_italic, FontWeight.Normal, FontStyle.Italic),
)

private fun sans(weight: Int) = Font(
    R.font.instrument_sans,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

val SansFamily = FontFamily(sans(400), sans(500), sans(600), sans(700))

private fun mono(weight: Int) = Font(
    R.font.jetbrains_mono,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

val MonoFamily = FontFamily(mono(400), mono(500))

/** Type ramp from the Figma designs: serif for headlines/big numbers, sans for UI, mono for data. */
@Immutable
data class AlmanacType(
    val display: TextStyle = TextStyle(fontFamily = SerifFamily, fontSize = 38.sp, lineHeight = 40.sp),
    val headline: TextStyle = TextStyle(fontFamily = SerifFamily, fontSize = 30.sp, lineHeight = 32.sp),
    val title: TextStyle = TextStyle(fontFamily = SerifFamily, fontSize = 22.sp, lineHeight = 26.sp),
    val bigNumber: TextStyle = TextStyle(fontFamily = SerifFamily, fontSize = 52.sp, lineHeight = 52.sp),
    val body: TextStyle = TextStyle(fontFamily = SansFamily, fontSize = 15.sp, lineHeight = 21.sp),
    val bodyStrong: TextStyle = TextStyle(fontFamily = SansFamily, fontSize = 15.sp, lineHeight = 21.sp, fontWeight = FontWeight.SemiBold),
    val small: TextStyle = TextStyle(fontFamily = SansFamily, fontSize = 13.sp, lineHeight = 18.sp),
    val caption: TextStyle = TextStyle(fontFamily = SansFamily, fontSize = 12.sp, lineHeight = 16.sp),
    val button: TextStyle = TextStyle(fontFamily = SansFamily, fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
    val label: TextStyle = TextStyle(fontFamily = MonoFamily, fontSize = 10.5.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.08.em),
    val data: TextStyle = TextStyle(fontFamily = MonoFamily, fontSize = 15.sp, fontWeight = FontWeight.Medium),
    val dataLarge: TextStyle = TextStyle(fontFamily = MonoFamily, fontSize = 20.sp, fontWeight = FontWeight.Medium),
)

val LocalAlmanacType = staticCompositionLocalOf { AlmanacType() }
