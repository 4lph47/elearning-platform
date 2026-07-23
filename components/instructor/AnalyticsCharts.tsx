"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Users, Wallet, BookOpen, Eye, ThumbsUp, MessageSquare, ClipboardCheck, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface WeekPoint {
  week: string;
  count: number;
}

export interface CourseMetric {
  id: string;
  title: string;
  enrollments: number;
  revenue: number;
  rating: number;
  ratingCount: number;
  likes: number;
  comments: number;
  engagement: number;
  views: number;
  avgWatchMinutes: number;
}

export interface LessonMetric {
  id: string;
  title: string;
  courseTitle: string;
  courseId: string;
  moduleId: string;
  views: number;
  likes: number;
  comments: number;
  avgWatchMinutes: number;
}

export interface QuizScoreMetric {
  id: string;
  title: string;
  courseTitle: string;
  avgScore: number;
  attempts: number;
  courseId: string;
  moduleId: string | null;
  lessonId: string | null;
}

export interface HourPoint {
  hour: string;
  count: number;
}

interface Totals {
  enrollments: number;
  revenue: number;
  lessons: number;
  views: number;
  likes: number;
  comments: number;
  courses: number;
}

type TileKey = "courses" | "enrollments" | "revenue" | "lessons" | "views" | "likes" | "comments" | "quizzes" | "activity";
const TILE_KEYS: TileKey[] = ["courses", "enrollments", "revenue", "lessons", "views", "likes", "comments", "quizzes", "activity"];

const AXIS_COLOR = "#94a3b8"; // slate-400 — legível em fundo claro e escuro
const GRID_COLOR = "#94a3b833";
const BAR_COLOR = "#3987e5";
const QUALITATIVE_COLORS = ["#2563eb", "#dc2626", "#eab308", "#16a34a", "#9333ea", "#f97316", "#0d9488", "#64748b"];
const TOOLTIP_STYLE = {
  backgroundColor: "#1e293b",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
};
const CLICKABLE_BAR_STYLE = { cursor: "pointer" as const };

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  active,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[140px] flex-1 basis-[140px] rounded-xl border p-4 text-left transition-colors ${
        active
          ? "border-blue-600 bg-blue-600 dark:border-blue-600 dark:bg-blue-600"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-neutral-900 dark:hover:border-white/20"
      }`}
    >
      <div className={`flex items-center gap-2 ${active ? "text-white" : "text-slate-500"}`}>
        <Icon size={15} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${active ? "text-white" : "text-slate-900 dark:text-white"}`}>{value}</p>
      <p className={`text-xs ${active ? "text-white" : "text-slate-500"}`}>{hint}</p>
    </button>
  );
}

function PieHoverTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { name: string; value: number; color: string } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: datum.color,
        color: "#fff",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {datum.name}: {datum.value}
    </div>
  );
}

function MiniPie<T extends { name: string; value: number }>({
  title,
  data,
  onSliceClick,
  legendOffset = 0,
}: {
  title: string;
  data: T[];
  onSliceClick?: (datum: T) => void;
  legendOffset?: number;
}) {
  const colored = data.map((d, i) => ({ ...d, color: QUALITATIVE_COLORS[i % QUALITATIVE_COLORS.length] }));

  return (
    <div>
      <h3 className="mb-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={colored} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={0}>
            {colored.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.color}
                stroke="none"
                style={onSliceClick ? { cursor: "pointer" } : undefined}
                onClick={() => onSliceClick?.(entry)}
              />
            ))}
          </Pie>
          {/* width limitado — texto mais comprido quebra em duas linhas em vez
              de espremer/sobrepor o gráfico. */}
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ fontSize: 11, color: AXIS_COLOR, right: 20 + legendOffset, width: 130, lineHeight: 1.3 }}
          />
          <Tooltip cursor={false} isAnimationActive={false} content={<PieHoverTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="font-medium text-slate-900 dark:text-white">{title}</h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      {children}
    </Card>
  );
}

// Todos os gráficos que dão uma visão holística: agregado total (topo,
// cards clicáveis — cada um com o seu próprio gráfico específico),
// comparação entre cursos (vendas/receita/avaliação/engajamento/tempo de
// visão) e comparação entre AULAS especificamente (views/likes/comentários/
// tempo de visão por aula, através de todos os cursos), mais notas de quiz e
// atividade por hora do dia. As barras ligadas a um curso/aula/quiz são
// clicáveis — levam à página de gestão respetiva.
export function AnalyticsCharts({
  totals,
  enrollmentsByWeek,
  revenueByWeek,
  courseStatus,
  courseCategoryBreakdown,
  courseLevelBreakdown,
  lessonTypeBreakdown,
  courseMetrics,
  lessonMetrics,
  quizScores,
  hourOfDay,
}: {
  totals: Totals;
  enrollmentsByWeek: WeekPoint[];
  revenueByWeek: WeekPoint[];
  courseStatus: { published: number; draft: number };
  courseCategoryBreakdown: { name: string; value: number; category: string }[];
  courseLevelBreakdown: { name: string; value: number; level: string }[];
  lessonTypeBreakdown: { type: string; count: number }[];
  courseMetrics: CourseMetric[];
  lessonMetrics: LessonMetric[];
  quizScores: QuizScoreMetric[];
  hourOfDay: HourPoint[];
}) {
  const router = useRouter();
  // Cards do dashboard (app/instructor/page.tsx) linkam para cá com ?tile=X —
  // deixa aterrar diretamente no gráfico certo, em vez de sempre em "Matrículas".
  const tileParam = useSearchParams().get("tile") as TileKey | null;
  const [selectedTile, setSelectedTile] = useState<TileKey>(
    tileParam && TILE_KEYS.includes(tileParam) ? tileParam : "enrollments"
  );
  const [fadingOut, setFadingOut] = useState(false);

  const FADE_OUT_MS = 250;
  const navigate = (href: string) => {
    setFadingOut(true);
    setTimeout(() => router.push(href), FADE_OUT_MS);
  };

  const goToCourse = (courseId: string) => navigate(`/instructor/courses/${courseId}`);
  const goToLesson = (courseId: string, moduleId: string, lessonId: string) =>
    navigate(`/instructor/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
  const goToQuiz = (q: QuizScoreMetric) => {
    if (q.lessonId && q.moduleId) return goToLesson(q.courseId, q.moduleId, q.lessonId);
    if (q.moduleId) return navigate(`/instructor/courses/${q.courseId}/modules/${q.moduleId}/quizzes/${q.id}`);
    return goToCourse(q.courseId);
  };

  const byRevenue = [...courseMetrics].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const byEnrollments = [...courseMetrics].sort((a, b) => b.enrollments - a.enrollments).slice(0, 10);
  const byRating = [...courseMetrics]
    .filter((c) => c.ratingCount > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);
  const byEngagement = [...courseMetrics].sort((a, b) => b.engagement - a.engagement).slice(0, 10);
  const coursesByViews = [...courseMetrics].sort((a, b) => b.views - a.views).slice(0, 10);
  const coursesByLikes = [...courseMetrics].sort((a, b) => b.likes - a.likes).slice(0, 10);
  const coursesByComments = [...courseMetrics].sort((a, b) => b.comments - a.comments).slice(0, 10);
  const coursesByWatchTime = [...courseMetrics].sort((a, b) => b.avgWatchMinutes - a.avgWatchMinutes).slice(0, 10);

  const lessonsByViews = [...lessonMetrics].sort((a, b) => b.views - a.views).slice(0, 10);
  const lessonsByLikes = [...lessonMetrics].sort((a, b) => b.likes - a.likes).slice(0, 10);
  const lessonsByComments = [...lessonMetrics].sort((a, b) => b.comments - a.comments).slice(0, 10);
  const lessonsByWatchTime = [...lessonMetrics].sort((a, b) => b.avgWatchMinutes - a.avgWatchMinutes).slice(0, 10);

  const quizScoresTop = [...quizScores].slice(0, 10);

  const courseBarHeight = (n: number) => Math.max(120, n * 34);
  const lessonBarHeight = (n: number) => Math.max(120, n * 34);
  const quizBarHeight = (n: number) => Math.max(120, n * 34);

  const courseStatusData = [
    { name: "Publicados", value: courseStatus.published },
    { name: "Rascunhos", value: courseStatus.draft },
  ];

  const overallQuizAvg = quizScores.length
    ? Math.round(quizScores.reduce((s, q) => s + q.avgScore, 0) / quizScores.length)
    : null;

  const peakHour = hourOfDay.reduce((best, h) => (h.count > best.count ? h : best), hourOfDay[0] ?? { hour: "—", count: 0 });

  const tiles: {
    key: TileKey;
    icon: typeof Users;
    label: string;
    value: string;
    hint: string;
    chartTitle: string;
    chartHint: string;
    render: () => React.ReactNode;
  }[] = [
    {
      key: "courses",
      icon: BookOpen,
      label: "Cursos",
      value: String(totals.courses),
      hint: "no total",
      chartTitle: "Cursos",
      chartHint: "Três ângulos lado a lado: estado, categoria e nível. Clica numa fatia para navegar.",
      render: () => (
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-4">
          <MiniPie title="Por estado" data={courseStatusData} onSliceClick={() => navigate("/instructor")} />
          <MiniPie
            title="Por categoria"
            data={courseCategoryBreakdown}
            onSliceClick={(d) => navigate(`/courses?category=${encodeURIComponent(d.category)}`)}
            legendOffset={-8}
          />
          <MiniPie
            title="Por nível"
            data={courseLevelBreakdown}
            onSliceClick={(d) => navigate(`/courses?level=${encodeURIComponent(d.level)}`)}
          />
        </div>
      ),
    },
    {
      key: "enrollments",
      icon: Users,
      label: "Matrículas",
      value: String(totals.enrollments),
      hint: "no total",
      chartTitle: "Matrículas por semana",
      chartHint: "Últimas 12 semanas, somando todos os cursos.",
      render: () => (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={enrollmentsByWeek}>
            <defs>
              <linearGradient id="enrollmentsFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BAR_COLOR} stopOpacity={0.35} />
                <stop offset="100%" stopColor={BAR_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="week" stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#fff" }} />
            <Area
              type="monotone"
              dataKey="count"
              name="Matrículas"
              stroke={BAR_COLOR}
              strokeWidth={2}
              fill="url(#enrollmentsFade)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: "revenue",
      icon: Wallet,
      label: "Receita",
      value: `${totals.revenue.toFixed(2)}€`,
      hint: "estimativa total",
      chartTitle: "Receita por semana",
      chartHint: "Últimas 12 semanas, somando todos os cursos.",
      render: () => (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueByWeek}>
            <defs>
              <linearGradient id="revenueFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BAR_COLOR} stopOpacity={0.35} />
                <stop offset="100%" stopColor={BAR_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="week" stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#fff" }} formatter={(v) => `${Number(v).toFixed(2)}€`} />
            <Area
              type="monotone"
              dataKey="count"
              name="Receita"
              stroke={BAR_COLOR}
              strokeWidth={2}
              fill="url(#revenueFade)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: "lessons",
      icon: BookOpen,
      label: "Aulas",
      value: String(totals.lessons),
      hint: "publicadas",
      chartTitle: "Aulas por tipo",
      chartHint: "Vídeo, texto e quiz, através de todos os cursos.",
      render: () => (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={lessonTypeBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="type" stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" name="Aulas" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: "views",
      icon: Eye,
      label: "Visualizações",
      value: String(totals.views),
      hint: "todas as aulas",
      chartTitle: "Cursos mais vistos",
      chartHint: "Top 10 cursos, somando as visualizações das suas aulas. Clica numa barra para abrir o curso.",
      render: () => (
        <ResponsiveContainer width="100%" height={courseBarHeight(coursesByViews.length)}>
          <BarChart data={coursesByViews} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
            <YAxis
              type="category"
              dataKey="title"
              stroke={AXIS_COLOR}
              fontSize={11}
              width={140}
              tickFormatter={(v: string) => truncate(v, 20)}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} />
            <Bar
              dataKey="views"
              name="Visualizações"
              fill={BAR_COLOR}
              radius={[0, 4, 4, 0]}
              style={CLICKABLE_BAR_STYLE}
              onClick={(data) => goToCourse(data.payload.id)}
            />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: "likes",
      icon: ThumbsUp,
      label: "Likes",
      value: String(totals.likes),
      hint: "todas as aulas",
      chartTitle: "Cursos com mais likes",
      chartHint: "Top 10 cursos, somando os likes das suas aulas. Clica numa barra para abrir o curso.",
      render: () => (
        <ResponsiveContainer width="100%" height={courseBarHeight(coursesByLikes.length)}>
          <BarChart data={coursesByLikes} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
            <YAxis
              type="category"
              dataKey="title"
              stroke={AXIS_COLOR}
              fontSize={11}
              width={140}
              tickFormatter={(v: string) => truncate(v, 20)}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} />
            <Bar
              dataKey="likes"
              name="Likes"
              fill={BAR_COLOR}
              radius={[0, 4, 4, 0]}
              style={CLICKABLE_BAR_STYLE}
              onClick={(data) => goToCourse(data.payload.id)}
            />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: "comments",
      icon: MessageSquare,
      label: "Comentários",
      value: String(totals.comments),
      hint: "todas as aulas",
      chartTitle: "Cursos mais comentados",
      chartHint: "Top 10 cursos, somando os comentários das suas aulas. Clica numa barra para abrir o curso.",
      render: () => (
        <ResponsiveContainer width="100%" height={courseBarHeight(coursesByComments.length)}>
          <BarChart data={coursesByComments} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
            <YAxis
              type="category"
              dataKey="title"
              stroke={AXIS_COLOR}
              fontSize={11}
              width={140}
              tickFormatter={(v: string) => truncate(v, 20)}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} />
            <Bar
              dataKey="comments"
              name="Comentários"
              fill={BAR_COLOR}
              radius={[0, 4, 4, 0]}
              style={CLICKABLE_BAR_STYLE}
              onClick={(data) => goToCourse(data.payload.id)}
            />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: "quizzes",
      icon: ClipboardCheck,
      label: "Quizzes",
      value: overallQuizAvg !== null ? `${overallQuizAvg}%` : "—",
      hint: "nota média",
      chartTitle: "Notas médias por quiz",
      chartHint: "Top 10 quizzes por nº de tentativas. Clica numa barra para abrir o quiz.",
      render: () =>
        quizScoresTop.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Ainda sem tentativas de quiz.</p>
        ) : (
          <ResponsiveContainer width="100%" height={quizBarHeight(quizScoresTop.length)}>
            <BarChart data={quizScoresTop} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={11}
                width={140}
                tickFormatter={(v: string) => truncate(v, 20)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE}
                formatter={(v, _n, item) => [`${v}% (${item.payload.attempts} tentativas)`, "Nota média"]}
                labelFormatter={(_l, item) =>
                  item?.[0]?.payload ? `${item[0].payload.title} · ${item[0].payload.courseTitle}` : ""
                }
              />
              <Bar
                dataKey="avgScore"
                name="Nota média"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToQuiz(data.payload)}
              />
            </BarChart>
          </ResponsiveContainer>
        ),
    },
    {
      key: "activity",
      icon: Clock,
      label: "Atividade",
      value: peakHour.count > 0 ? peakHour.hour : "—",
      hint: "hora de pico",
      chartTitle: "Atividade por hora do dia",
      chartHint: "Quando é que as pessoas costumam estar a ver aulas, todos os cursos.",
      render: () => (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourOfDay}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="hour" stroke={AXIS_COLOR} fontSize={10} interval={1} tickLine={false} />
            <YAxis stroke={AXIS_COLOR} fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" name="Visualizações" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
  ];

  const active = tiles.find((t) => t.key === selectedTile)!;

  return (
    <div
      className="space-y-6"
      style={{ opacity: fadingOut ? 0 : 1, transition: `opacity ${FADE_OUT_MS}ms ease-out` }}
    >
      <div className="flex flex-wrap gap-4">
        {tiles.map((t) => (
          <StatTile
            key={t.key}
            icon={t.icon}
            label={t.label}
            value={t.value}
            hint={t.hint}
            active={selectedTile === t.key}
            onClick={() => setSelectedTile(t.key)}
          />
        ))}
      </div>

      <ChartCard title={active.chartTitle} hint={active.chartHint}>
        {active.render()}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Cursos por receita" hint="Top 10, preço × matrículas. Clica numa barra para abrir o curso.">
          <ResponsiveContainer width="100%" height={courseBarHeight(byRevenue.length)}>
            <BarChart data={byRevenue} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={11}
                width={140}
                tickFormatter={(v: string) => truncate(v, 20)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} formatter={(v) => `${Number(v).toFixed(2)}€`} />
              <Bar
                dataKey="revenue"
                name="Receita"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToCourse(data.payload.id)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cursos mais matriculados" hint="Top 10, os mais populares/comprados. Clica numa barra para abrir o curso.">
          <ResponsiveContainer width="100%" height={courseBarHeight(byEnrollments.length)}>
            <BarChart data={byEnrollments} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={11}
                width={140}
                tickFormatter={(v: string) => truncate(v, 20)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} />
              <Bar
                dataKey="enrollments"
                name="Matrículas"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToCourse(data.payload.id)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div id="rating" className="scroll-mt-20">
        <ChartCard title="Cursos mais bem avaliados" hint="Top 10 por avaliação média (só com avaliações). Clica numa barra para abrir o curso.">
          <ResponsiveContainer width="100%" height={courseBarHeight(byRating.length)}>
            <BarChart data={byRating} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" domain={[0, 5]} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={11}
                width={140}
                tickFormatter={(v: string) => truncate(v, 20)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE}
                formatter={(v, _n, item) => [`${Number(v).toFixed(1)} (${item.payload.ratingCount} avaliações)`, "Avaliação"]}
              />
              <Bar
                dataKey="rating"
                name="Avaliação"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToCourse(data.payload.id)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        </div>

        <ChartCard title="Cursos com mais engajamento" hint="Top 10 por likes + comentários somados nas suas aulas. Clica numa barra para abrir o curso.">
          <ResponsiveContainer width="100%" height={courseBarHeight(byEngagement.length)}>
            <BarChart data={byEngagement} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={11}
                width={140}
                tickFormatter={(v: string) => truncate(v, 20)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE}
                formatter={(_v, _n, item) => [`${item.payload.likes} likes · ${item.payload.comments} comentários`, "Engajamento"]}
              />
              <Bar
                dataKey="engagement"
                name="Engajamento"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToCourse(data.payload.id)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cursos por tempo médio de visão" hint="Top 10, minutos médios por pessoa nas aulas do curso. Clica numa barra para abrir o curso.">
          <ResponsiveContainer width="100%" height={courseBarHeight(coursesByWatchTime.length)}>
            <BarChart data={coursesByWatchTime} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={11}
                width={140}
                tickFormatter={(v: string) => truncate(v, 20)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v} min`} />
              <Bar
                dataKey="avgWatchMinutes"
                name="Tempo médio"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToCourse(data.payload.id)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Aulas em destaque</h2>
      <p className="-mt-4 text-sm text-slate-500 dark:text-slate-400">
        Não só cursos — cada aula individualmente, através de todos os cursos.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Aulas mais vistas" hint="Top 10 por visualizações. Clica numa barra para abrir a aula.">
          <ResponsiveContainer width="100%" height={lessonBarHeight(lessonsByViews.length)}>
            <BarChart data={lessonsByViews} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={10}
                width={110}
                tickFormatter={(v: string) => truncate(v, 15)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE}
                labelFormatter={(_l, item) => item?.[0]?.payload ? `${item[0].payload.title} · ${item[0].payload.courseTitle}` : ""}
              />
              <Bar
                dataKey="views"
                name="Visualizações"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToLesson(data.payload.courseId, data.payload.moduleId, data.payload.id)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Aulas com mais likes" hint="Top 10 por reações positivas. Clica numa barra para abrir a aula.">
          <ResponsiveContainer width="100%" height={lessonBarHeight(lessonsByLikes.length)}>
            <BarChart data={lessonsByLikes} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={10}
                width={110}
                tickFormatter={(v: string) => truncate(v, 15)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE}
                labelFormatter={(_l, item) => item?.[0]?.payload ? `${item[0].payload.title} · ${item[0].payload.courseTitle}` : ""}
              />
              <Bar
                dataKey="likes"
                name="Likes"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToLesson(data.payload.courseId, data.payload.moduleId, data.payload.id)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Aulas mais comentadas" hint="Top 10 por número de comentários. Clica numa barra para abrir a aula.">
          <ResponsiveContainer width="100%" height={lessonBarHeight(lessonsByComments.length)}>
            <BarChart data={lessonsByComments} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={10}
                width={110}
                tickFormatter={(v: string) => truncate(v, 15)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE}
                labelFormatter={(_l, item) => item?.[0]?.payload ? `${item[0].payload.title} · ${item[0].payload.courseTitle}` : ""}
              />
              <Bar
                dataKey="comments"
                name="Comentários"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToLesson(data.payload.courseId, data.payload.moduleId, data.payload.id)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Aulas por tempo médio de visão" hint="Top 10, minutos médios por pessoa. Clica numa barra para abrir a aula.">
          <ResponsiveContainer width="100%" height={lessonBarHeight(lessonsByWatchTime.length)}>
            <BarChart data={lessonsByWatchTime} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" stroke={AXIS_COLOR} fontSize={11} tickLine={false} />
              <YAxis
                type="category"
                dataKey="title"
                stroke={AXIS_COLOR}
                fontSize={10}
                width={110}
                tickFormatter={(v: string) => truncate(v, 15)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={false} isAnimationActive={false} contentStyle={TOOLTIP_STYLE}
                formatter={(v) => `${v} min`}
                labelFormatter={(_l, item) => item?.[0]?.payload ? `${item[0].payload.title} · ${item[0].payload.courseTitle}` : ""}
              />
              <Bar
                dataKey="avgWatchMinutes"
                name="Tempo médio"
                fill={BAR_COLOR}
                radius={[0, 4, 4, 0]}
                style={CLICKABLE_BAR_STYLE}
                onClick={(data) => goToLesson(data.payload.courseId, data.payload.moduleId, data.payload.id)}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
