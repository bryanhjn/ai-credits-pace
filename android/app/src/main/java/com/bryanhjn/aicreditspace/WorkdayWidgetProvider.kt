package com.bryanhjn.aicreditspace

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.util.Log
import android.widget.RemoteViews
import java.time.LocalDate
import java.util.Locale

/**
 * 2x2 桌面组件：显示工作日进度条 + AI Credits 进度条。
 *
 * 计算逻辑移植自 src/utils/workdayCalc.ts 与 App.tsx 第 120-132 行，
 * 直接读取 monthlyProgress.db（与 app 同进程，可直接访问内部 DB）。
 *
 * 注意：app 通过 expo-sqlite 开启了 WAL 模式（见 src/db/database.ts），
 * 近期写入可能仍在 -wal 文件中未 checkpoint。因此这里必须用
 * enableWriteAheadLogging=true 的方式打开 DB，才能读到完整的最新数据。
 */
class WorkdayWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) updateWidget(context, manager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, WorkdayWidgetProvider::class.java))
            for (id in ids) updateWidget(context, manager, id)
        }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_workday)

        // 点击组件打开 app —— 放在最前面，确保即使后续 action 失败点击也能生效
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

        val today = LocalDate.now()
        val (workdayPercent, creditsPercent, creditsRatio) = computeProgress(context, today)

        // 标题行文字（标题在进度条上方）
        views.setTextViewText(
            R.id.workday_text,
            "工作日(${formatPercent(workdayPercent)}%)"
        )
        views.setTextViewText(
            R.id.credits_text,
            "Credits(${formatPercent(creditsPercent)}%)"
        )

        // 工作日进度条（靛蓝 #6366F1，tint 在 XML 中静态设置）
        views.setProgressBar(
            R.id.workday_bar, 100,
            workdayPercent.toInt().coerceIn(0, 100), false
        )

        // Credits 进度条（按比率动态变色）
        views.setProgressBar(
            R.id.credits_bar, 100,
            creditsPercent.toInt().coerceIn(0, 100), false
        )
        // 仅 API 31+ 支持动态改 tint；低版本保持 XML 默认绿色
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            views.setColorStateList(
                R.id.credits_bar,
                "setProgressTintList",
                ColorStateList.valueOf(getCreditsColor(creditsRatio))
            )
        }

        manager.updateAppWidget(widgetId, views)
    }

    /**
     * 读取 SQLite 计算当月进度。
     * 返回 (workdayPercent, creditsPercent, creditsRatio)，无数据时全部为 0。
     */
    private fun computeProgress(
        context: Context,
        today: LocalDate
    ): Triple<Double, Double, Double> {
        val dbFile = context.getDatabasePath(DB_NAME)
        if (!dbFile.exists()) {
            Log.w(TAG, "DB file not found: ${dbFile.absolutePath}")
            return Triple(0.0, 0.0, 0.0)
        }

        var workdayPercent = 0.0
        var creditsPercent = 0.0
        var creditsRatio = 0.0

        try {
            // 关键：用 OPEN_READWRITE + enableWriteAheadLogging 才能读到 -wal 文件中的最新数据。
            // OPEN_READONLY 不会应用 WAL，导致读不到未 checkpoint 的写入。
            val db = SQLiteDatabase.openDatabase(
                dbFile.absolutePath, null,
                SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING
            )
            db.use {
                // 1. 工作日进度
                val (totalWorkdays, passedWorkdays) = queryWorkdays(it, today)
                workdayPercent = calcProgressPercent(passedWorkdays, totalWorkdays)

                // 2. Credits 进度（REAL 列）
                val (used, total) = queryCredits(it, today)
                creditsRatio = calcCreditsRatio(used, total)
                creditsPercent = Math.round(creditsRatio * 1000) / 10.0
            }
            Log.d(TAG, "computeProgress: workday=$workdayPercent%, credits=$creditsPercent% (ratio=$creditsRatio)")
        } catch (e: Exception) {
            Log.e(TAG, "computeProgress failed", e)
        }

        return Triple(workdayPercent, creditsPercent, creditsRatio)
    }

    /** 查询当月工作日，返回 (totalWorkdays, passedWorkdays)。 */
    private fun queryWorkdays(
        db: SQLiteDatabase,
        today: LocalDate
    ): Pair<Int, Int> {
        val cursor = db.rawQuery(
            "SELECT day, type FROM monthly_workdays WHERE year=? AND month=?",
            arrayOf(today.year.toString(), today.monthValue.toString())
        )
        var total = 0
        var passed = 0
        cursor.use { c ->
            while (c.moveToNext()) {
                val day = c.getInt(0)
                val type = c.getInt(1)
                if (isWorkdayType(type)) {
                    total++
                    if (day <= today.dayOfMonth) passed++
                }
            }
        }
        Log.d(TAG, "queryWorkdays ${today.year}-${today.monthValue}: total=$total passed=$passed")
        return total to passed
    }

    /** 查询当月 Credits，返回 (used, total)。无数据时返回默认值 (0, 3000)。 */
    private fun queryCredits(
        db: SQLiteDatabase,
        today: LocalDate
    ): Pair<Double, Double> {
        val cursor = db.rawQuery(
            "SELECT total_credits, used_credits FROM monthly_credits WHERE year=? AND month=?",
            arrayOf(today.year.toString(), today.monthValue.toString())
        )
        var total = DEFAULT_TOTAL_CREDITS.toDouble()
        var used = DEFAULT_USED_CREDITS.toDouble()
        cursor.use { c ->
            if (c.moveToFirst()) {
                total = c.getDouble(0)
                used = c.getDouble(1)
            }
        }
        Log.d(TAG, "queryCredits ${today.year}-${today.monthValue}: used=$used total=$total")
        return used to total
    }

    companion object {
        private const val TAG = "WorkdayWidget"
        const val ACTION_REFRESH = "com.bryanhjn.aicreditspace.ACTION_REFRESH_WIDGET"
        private const val DB_NAME = "monthlyProgress.db"
        private const val DEFAULT_TOTAL_CREDITS = 6000
        private const val DEFAULT_USED_CREDITS = 0

        private const val COLOR_CREDITS_SAFE = 0xFF10B981.toInt()
        private const val COLOR_CREDITS_WARNING = 0xFFF59E0B.toInt()
        private const val COLOR_CREDITS_DANGER = 0xFFEF4444.toInt()

        // ===== 移植自 src/utils/workdayCalc.ts =====

        // DayType: 0=Workday, 1=Weekend, 2=Holiday, 3=AdjustedWorkday, 4=Overtime, 5=Leave
        private fun isWorkdayType(type: Int): Boolean = type == 0 || type == 3 || type == 4

        // 计算进度百分比（0-100，保留 1 位小数）
        private fun calcProgressPercent(passed: Int, total: Int): Double {
            if (total <= 0) return 0.0
            val pct = passed.toDouble() / total * 100
            return Math.round(pct * 10) / 10.0
        }

        // 计算 Credits 使用比例（0-1，可能 >1）
        private fun calcCreditsRatio(used: Double, total: Double): Double {
            if (total <= 0) return 0.0
            return used / total
        }

        // ===== 移植自 src/theme.ts getCreditsColor() =====
        // >1 → 红, >=0.7 → 橙, else → 绿
        private fun getCreditsColor(ratio: Double): Int = when {
            ratio > 1.0  -> COLOR_CREDITS_DANGER
            ratio >= 0.7 -> COLOR_CREDITS_WARNING
            else         -> COLOR_CREDITS_SAFE
        }

        // 格式化为 1 位小数字符串（与 app 内显示一致，固定用点号分隔）
        private fun formatPercent(value: Double): String {
            return String.format(Locale.US, "%.1f", value)
        }
    }
}
