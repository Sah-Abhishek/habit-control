package com.almanac.tracker.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Stroke icons drawn from the same SVG paths as the web app (24×24, 1.8 stroke). */
enum class AlmanacIcon(vararg val paths: String) {
    Today("M12 8a4 4 0 1 0 0.01 0z", "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"),
    Plan("M5 21V4", "M5 4h11l-2 4 2 4H5"),
    Book("M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5z", "M4 20a2 2 0 0 1 2-2h13v3H6"),
    Habits("M17 2.5l3 3-3 3", "M4 11.5v-2a4 4 0 0 1 4-4h12", "M7 21.5l-3-3 3-3", "M20 12.5v2a4 4 0 0 1-4 4H4"),
    Insights("M3 20h18", "M6 16v-4M11 16V7M16 16v-6M20 16V4"),
    Calendar("M6.5 5h11a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z", "M3.5 10h17M8 3v4M16 3v4"),
    Settings("M12 9a3 3 0 1 0 0.01 0z", "M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"),
    Moon("M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"),
    Play("M8 5.5v13l10.5-6.5z"),
    Pause("M9 5v14M15 5v14"),
    Stop("M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"),
    Plus("M12 5v14M5 12h14"),
    Minus("M5 12h14"),
    Check("M5 12.5l4.5 4.5L19 7.5"),
    Close("M6 6l12 12M18 6L6 18"),
    Spark("M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"),
    Alert("M12 3.5l9.5 16.5h-19z", "M12 10v4M12 17h.01"),
    Back("M15 6l-6 6 6 6"),
    Forward("M9 6l6 6-6 6"),
    More("M5 12h.01M12 12h.01M19 12h.01"),
    Trash("M4 7h16M10 11v6M14 11v6", "M6 7l1 13h10l1-13M9 7V4h6v3"),
    Edit("M4 20h4L19 9l-4-4L4 16z", "M13.5 6.5l4 4"),
    Logout("M15 4h4v16h-4", "M10 8l-4 4 4 4M6 12h10"),
    CloudOff("M3 3l18 18", "M7 18h10M17.5 10A6 6 0 0 0 9 6.5M6 9.5A4.3 4.3 0 0 0 7 18"),
    Refresh("M20 11a8 8 0 0 0-14.6-4.5L4 8", "M4 3.5V8h4.5", "M4 13a8 8 0 0 0 14.6 4.5L20 16", "M20 20.5V16h-4.5"),
    Down("M12 5v14M6 13l6 6 6-6"),
    Up("M12 19V5M6 11l6-6 6 6"),
    Lock("M7.5 11h9a2.5 2.5 0 0 1 2.5 2.5V18a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18v-4.5A2.5 2.5 0 0 1 7.5 11z", "M8 11V8a4 4 0 0 1 8 0v3"),
    Bolt("M13 2.5L4.5 13.5H12L11 21.5l8.5-11H12z"),
    Smile("M12 3a9 9 0 1 0 0.01 0z", "M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"),
    Wave("M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"),
    Note("M5 4h10l4 4v12H5z", "M14 4v5h5M8.5 13h7M8.5 16.5h5"),
    Task("M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z", "M8.5 12l2.5 2.5 4.5-5"),
    ;

    val vector: ImageVector by lazy {
        val builder = ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
        for (d in paths) {
            builder.addPath(
                pathData = PathParser().parsePathString(d).toNodes(),
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 1.8f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
        builder.build()
    }
}

@Composable
fun AIcon(icon: AlmanacIcon, contentDescription: String?, tint: Color, size: Dp = 20.dp, modifier: Modifier = Modifier) {
    Icon(icon.vector, contentDescription = contentDescription, tint = tint, modifier = modifier.size(size))
}
