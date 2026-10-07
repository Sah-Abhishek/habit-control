package com.almanac.tracker.core.model

import kotlinx.serialization.Serializable

@Serializable
data class MeResponse(val user: UserDto, val today: String, val settings: SettingsDto)

@Serializable
data class UserDto(val id: String, val email: String, val name: String)

@Serializable
data class SettingsDto(
    val timezone: String = "UTC",
    val theme: String = "system",
    val weekStartsOn: Int = 1,
    val dailyStudyTargetMin: Int = 120,
    val revisionScheduleDays: List<Int> = listOf(1, 3, 7, 21, 45),
    val quietMode: Boolean = false,
    val onboarded: Boolean = false,
)
