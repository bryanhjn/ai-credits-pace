package com.bryanhjn.aicreditspace

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.database.sqlite.SQLiteDatabase
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.Log
import android.widget.RemoteViews
import java.io.File
import java.time.LocalDate

/**
 * 双圆环桌面组件：内圈工作日进度 + 外圈 AI Credits 进度，
 * 中心显示百分比数字，Apple Watch 运动圆环风格。
 *
 * 通过 Canvas 绘制 512×512 Bitmap 后设置到 ImageView，
 * 计算逻辑移植自 src/utils/workdayCalc.ts 与 App.tsx。
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

        // 点击组件打开 app
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

        val today = LocalDate.now()
        val (workdayPercent, creditsPercent, paceDiff) = computeProgress(context, today)

        val isDark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

        val bitmap = renderRingWidget(workdayPercent, creditsPercent, paceDiff, isDark)
        views.setImageViewBitmap(R.id.widget_image, bitmap)

        manager.updateAppWidget(widgetId, views)
    }

    // ============================
    //  位图渲染：双圆环 + 中心文字
    // ============================

    private fun renderRingWidget(
        workdayPercent: Double,
        creditsPercent: Double,
        paceDiff: Double,
        isDark: Boolean
    ): Bitmap {
        val w = 512f
        val h = 512f
        val cx = w / 2f
        val cy = h / 2f

        val bitmap = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // ---- 背景：浅色模式用 APP 背景色 #FAF9F5，深色模式用暗色 ----
        val bgColor = if (isDark) Color.parseColor("#1E1E2E") else Color.parseColor("#FAF9F5")
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = bgColor }
        canvas.drawRoundRect(RectF(0f, 0f, w, h), 48f, 48f, bgPaint)

        // ---- 圆环参数（加粗到 2 倍）----
        // 外圈: Credits
        val outerRadius = 200f
        val outerThickness = 44f
        // 内圈: 工作日
        val innerRadius = 140f
        val innerThickness = 44f

        val creditsColor = getCreditsColor(paceDiff)

        // ---- 外圈：Credits ----
        drawArcRing(
            canvas, cx, cy, outerRadius, outerThickness,
            (creditsPercent / 100.0).toFloat(),
            creditsColor
        )

        // ---- 内圈：工作日 ----
        drawArcRing(
            canvas, cx, cy, innerRadius, innerThickness,
            (workdayPercent / 100.0).toFloat(),
            COLOR_WORKDAY
        )

        // ---- 中心百分比文字 ----
        val workdayInt = workdayPercent.toInt()
        val creditsInt = creditsPercent.toInt()

        // 工作日百分比（上方）
        val workdayTextColor = if (isDark) Color.parseColor("#A5B4FC") else COLOR_WORKDAY
        val workdayTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            color = workdayTextColor
            textSize = 72f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText("${workdayInt}%", cx, cy - 12f, workdayTextPaint)

        // Credits 百分比（下方）
        val creditsTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            color = creditsColor
            textSize = 72f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText("${creditsInt}%", cx, cy + 64f, creditsTextPaint)

        return bitmap
    }

    /**
     * 绘制一段圆环弧线（带圆角端点 + 淡色轨道）。
     * 轨道颜色取 fillColor 的 RGB + 低 alpha，呈现更淡的同色调。
     * @param sweepFraction 进度 0..1，超过 1 时按 1 处理
     */
    private fun drawArcRing(
        canvas: Canvas,
        cx: Float, cy: Float,
        radius: Float,
        thickness: Float,
        sweepFraction: Float,
        fillColor: Int
    ) {
        val rect = RectF(cx - radius, cy - radius, cx + radius, cy + radius)
        val sweep = (sweepFraction.coerceIn(0f, 1f) * 360f)

        // 轨道：fillColor 的 RGB + 15% alpha
        val trackColor = (fillColor and 0x00FFFFFF) or 0x26000000

        // 轨道
        val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = thickness
            strokeCap = Paint.Cap.ROUND
            color = trackColor
        }
        canvas.drawArc(rect, START_ANGLE, 360f, false, trackPaint)

        // 进度弧
        if (sweep > 0f) {
            val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = thickness
                strokeCap = Paint.Cap.ROUND
                color = fillColor
            }
            canvas.drawArc(rect, START_ANGLE, sweep, false, progressPaint)
        }
    }

    // ============================
    //  SQLite 读数
    // ============================

    /**
     * 读取 SQLite 计算当月进度。
     * 返回 (workdayPercent, creditsPercent, paceDiff)，无数据时全部为 0。
     */
    private fun computeProgress(
        context: Context,
        today: LocalDate
    ): Triple<Double, Double, Double> {
        // expo-sqlite 将数据库存在 filesDir/SQLite/ 下，而非 Android 默认的 databases/ 目录
        val dbFile = File(context.filesDir, "SQLite/$DB_NAME")
        if (!dbFile.exists()) {
            Log.w(TAG, "DB file not found: ${dbFile.absolutePath}")
            return Triple(0.0, 0.0, 0.0)
        }

        var workdayPercent = 0.0
        var creditsPercent = 0.0
        var creditsRatio = 0.0

        try {
            val db = SQLiteDatabase.openDatabase(
                dbFile.absolutePath, null,
                SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING
            )
            db.use {
                val (totalWorkdays, passedWorkdays) = queryWorkdays(it, today)
                workdayPercent = calcProgressPercent(passedWorkdays, totalWorkdays)

                val (used, total) = queryCredits(it, today)
                creditsRatio = calcCreditsRatio(used, total)
                creditsPercent = Math.round(creditsRatio * 1000) / 10.0
            }
            Log.d(TAG, "computeProgress: workday=$workdayPercent%, credits=$creditsPercent% (paceDiff=${creditsPercent - workdayPercent})")
        } catch (e: Exception) {
            Log.e(TAG, "computeProgress failed", e)
        }

        return Triple(workdayPercent, creditsPercent, creditsPercent - workdayPercent)
    }

    private fun queryWorkdays(db: SQLiteDatabase, today: LocalDate): Pair<Int, Int> {
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

    private fun queryCredits(db: SQLiteDatabase, today: LocalDate): Pair<Double, Double> {
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

    // ============================
    //  companion
    // ============================

    companion object {
        private const val TAG = "WorkdayWidget"
        const val ACTION_REFRESH = "com.bryanhjn.aicreditspace.ACTION_REFRESH_WIDGET"
        private const val DB_NAME = "monthlyProgress.db"
        private const val DEFAULT_TOTAL_CREDITS = 6000
        private const val DEFAULT_USED_CREDITS = 0

        // 圆环起始角度（-90° = 12 点钟方向）
        private const val START_ANGLE = -90f

        // 与 APP 一致的颜色
        private const val COLOR_WORKDAY = 0xFF6366F1.toInt() // Indigo
        private const val COLOR_CREDITS_SAFE = 0xFF10B981.toInt()   // 绿
        private const val COLOR_CREDITS_WARNING = 0xFFF59E0B.toInt() // 黄
        private const val COLOR_CREDITS_DANGER = 0xFFEF4444.toInt()  // 红

        private const val PACE_THRESHOLD_PERCENT = 5.0

        // ===== 移植自 src/utils/workdayCalc.ts =====

        private fun isWorkdayType(type: Int): Boolean = type == 0 || type == 3 || type == 4

        private fun calcProgressPercent(passed: Int, total: Int): Double {
            if (total <= 0) return 0.0
            val pct = passed.toDouble() / total * 100
            return Math.round(pct * 10) / 10.0
        }

        private fun calcCreditsRatio(used: Double, total: Double): Double {
            if (total <= 0) return 0.0
            return used / total
        }

        // ===== 移植自 src/theme.ts getCreditsColor() =====

        private fun getCreditsColor(diff: Double): Int = when {
            diff > PACE_THRESHOLD_PERCENT  -> COLOR_CREDITS_DANGER
            diff < -PACE_THRESHOLD_PERCENT -> COLOR_CREDITS_SAFE
            else                           -> COLOR_CREDITS_WARNING
        }
    }
}