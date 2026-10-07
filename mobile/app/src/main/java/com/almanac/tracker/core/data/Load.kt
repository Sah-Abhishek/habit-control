package com.almanac.tracker.core.data

import com.almanac.tracker.core.network.AppError

/**
 * Screen data state. `Ready` may carry `stale = true` (showing cache while refreshing
 * or after a failed refresh) and the `error` from that refresh, so screens can keep
 * showing content and explain what happened instead of blanking out.
 */
sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Ready<T>(val data: T, val stale: Boolean = false, val error: AppError? = null, val refreshing: Boolean = false) : Load<T>
    data class Failed(val error: AppError) : Load<Nothing>
}

val <T> Load<T>.dataOrNull: T? get() = (this as? Load.Ready<T>)?.data
