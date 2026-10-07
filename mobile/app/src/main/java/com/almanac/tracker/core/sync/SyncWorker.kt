package com.almanac.tracker.core.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.almanac.tracker.AlmanacApp
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.isRetryable
import com.almanac.tracker.core.network.toAppError
import java.util.concurrent.TimeUnit

/** Replays the outbox in order once a connection is available. */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val container = (applicationContext as AlmanacApp).container
        val outbox = container.outbox
        for (op in outbox.snapshot()) {
            try {
                container.api.requestRaw(op.method, op.path, emptyMap(), op.body).first.close()
                outbox.remove(op.id)
            } catch (t: Throwable) {
                val error = t.toAppError()
                when {
                    error is AppError.Unauthorized -> return Result.failure() // resumes after next sign-in
                    error.isRetryable -> return Result.retry()
                    else -> {
                        // The server refused it (deleted habit, invalid date…). Don't retry forever.
                        outbox.remove(op.id)
                        outbox.recordFailure(OutboxFailure(op.label, error.message))
                    }
                }
            }
        }
        container.onSyncCompleted()
        return Result.success()
    }

    companion object {
        private const val NAME = "outbox-sync"

        fun schedule(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }
    }
}
