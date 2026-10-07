package com.almanac.tracker.feature.plan

import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.GoalCardDto
import com.almanac.tracker.core.model.GoalDetailResponse
import com.almanac.tracker.core.model.GoalInputDto
import com.almanac.tracker.core.model.GoalsResponse
import com.almanac.tracker.core.model.MilestoneDto
import com.almanac.tracker.core.model.MilestoneInputDto
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable internal data class StatusBody(val status: String)
@Serializable internal data class CompleteBody(val complete: Boolean)

/** Goals + milestones API (docs/api.md → Goals). All writes need a connection. */
class GoalsRepository(private val container: AppContainer) {
    private val json get() = container.api.json()

    fun goals(): Flow<Load<GoalsResponse>> = container.cachedApi.stream("goals", serializer = GoalsResponse.serializer())

    fun detail(id: String): Flow<Load<GoalDetailResponse>> = container.cachedApi.stream("goals/$id", serializer = GoalDetailResponse.serializer())

    suspend fun create(input: GoalInputDto): GoalCardDto =
        container.mutations.send("POST", "goals", json.encodeToString(GoalInputDto.serializer(), input), GoalCardDto.serializer())

    suspend fun update(id: String, input: GoalInputDto): GoalCardDto =
        container.mutations.send("PATCH", "goals/$id", json.encodeToString(GoalInputDto.serializer(), input), GoalCardDto.serializer())

    suspend fun setStatus(id: String, status: String) {
        container.mutations.send("PUT", "goals/$id/status", json.encodeToString(StatusBody.serializer(), StatusBody(status)), JsonObject.serializer())
    }

    suspend fun makePrimary(id: String) {
        container.mutations.send("PUT", "goals/$id/primary", "{}", JsonObject.serializer())
    }

    suspend fun delete(id: String) = container.mutations.delete("goals/$id")

    suspend fun addMilestone(goalId: String, input: MilestoneInputDto): MilestoneDto =
        container.mutations.send("POST", "goals/$goalId/milestones", json.encodeToString(MilestoneInputDto.serializer(), input), MilestoneDto.serializer())

    suspend fun updateMilestone(id: String, input: MilestoneInputDto): MilestoneDto =
        container.mutations.send("PATCH", "milestones/$id", json.encodeToString(MilestoneInputDto.serializer(), input), MilestoneDto.serializer())

    suspend fun setMilestoneComplete(id: String, complete: Boolean): MilestoneDto =
        container.mutations.send("PUT", "milestones/$id/complete", json.encodeToString(CompleteBody.serializer(), CompleteBody(complete)), MilestoneDto.serializer())

    suspend fun deleteMilestone(id: String) = container.mutations.delete("milestones/$id")
}
