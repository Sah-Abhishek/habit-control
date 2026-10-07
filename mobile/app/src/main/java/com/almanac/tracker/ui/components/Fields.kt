package com.almanac.tracker.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.almanac.tracker.ui.theme.Almanac

/** Labeled text field with hint / error text wired for accessibility. */
@Composable
fun LabeledField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    error: String? = null,
    hint: String? = null,
    optional: Boolean = false,
    placeholder: String? = null,
    singleLine: Boolean = true,
    minLines: Int = 1,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    enabled: Boolean = true,
    trailing: (@Composable () -> Unit)? = null,
) {
    val c = Almanac.colors
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            if (optional) "$label  ·  optional" else label,
            style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold),
            color = c.ink,
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            isError = error != null,
            singleLine = singleLine,
            minLines = minLines,
            enabled = enabled,
            placeholder = placeholder?.let { { Text(it, style = Almanac.type.body, color = c.faint) } },
            textStyle = Almanac.type.body.copy(color = c.ink),
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            visualTransformation = visualTransformation,
            trailingIcon = trailing,
            shape = RoundedCornerShape(12.dp),
            supportingText = when {
                error != null -> { { Text(error, style = Almanac.type.caption, color = c.clay) } }
                hint != null -> { { Text(hint, style = Almanac.type.caption, color = c.faint) } }
                else -> null
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = c.moss,
                unfocusedBorderColor = c.line,
                errorBorderColor = c.clay,
                focusedContainerColor = c.card,
                unfocusedContainerColor = c.card,
                cursorColor = c.moss,
            ),
        )
    }
}

@Composable
fun FormError(message: String?) {
    if (message == null) return
    StatusBanner(message, AlmanacIcon.Alert, inverse = false)
}
