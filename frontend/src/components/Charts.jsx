import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT } from "../i18n/LanguageContext.jsx";
import { formatRupees } from "../utils/format.js";

const COLORS = ["#0369a1", "#15803d", "#b45309", "#b91c1c", "#6d28d9", "#0f766e", "#be185d", "#334155"];
const TICK = { fontSize: 16, fill: "#1e293b" }; // larger, darker axis text than the default
const TEXT = { fontSize: 16 };
const short = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

function ChartBox({ title, empty, children }) {
  const { t } = useT();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-xl font-bold">{title}</h3>
      <div className="h-72">
        {empty ? (
          <p className="flex h-full items-center justify-center text-lg text-slate-700">{t("report.noSales")}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/** Line chart: sales per day. */
export function DailySalesChart({ daily, title }) {
  const { t, fmt } = useT();
  const key = t("report.sales");
  const data = daily.map((d) => ({ day: fmt.day(d.date), [key]: Number(d.sales) }));
  return (
    <ChartBox title={title ?? t("report.chartDaily")} empty={data.every((d) => d[key] === 0)}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" interval="preserveStartEnd" minTickGap={24} tick={TICK} />
        <YAxis tickFormatter={short} width={50} tick={TICK} />
        <Tooltip formatter={formatRupees} contentStyle={TEXT} />
        <Line type="monotone" dataKey={key} stroke={COLORS[0]} strokeWidth={4} dot={data.length <= 31} />
      </LineChart>
    </ChartBox>
  );
}

/** Pie chart: share of each product in total sales. */
export function ProductPieChart({ products }) {
  const { t } = useT();
  const data = products.filter((p) => Number(p.sales) > 0).map((p) => ({ name: p.name, value: Number(p.sales) }));
  return (
    <ChartBox title={t("report.chartProducts")} empty={data.length === 0}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius="75%">
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={formatRupees} contentStyle={TEXT} />
        <Legend wrapperStyle={TEXT} />
      </PieChart>
    </ChartBox>
  );
}

/** Bar chart: sales and gross profit for each branch. */
export function BranchBarChart({ branches }) {
  const { t } = useT();
  const sales = t("report.sales");
  const profit = t("report.grossProfit");
  const data = branches.map((b) => ({ name: b.name, [sales]: Number(b.sales), [profit]: Number(b.profit) }));
  return (
    <ChartBox title={t("report.chartBranches")} empty={data.every((d) => d[sales] === 0)}>
      <BarChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={TICK} />
        <YAxis tickFormatter={short} width={50} tick={TICK} />
        <Tooltip formatter={formatRupees} contentStyle={TEXT} />
        <Legend wrapperStyle={TEXT} />
        <Bar dataKey={sales} fill={COLORS[0]} />
        <Bar dataKey={profit} fill={COLORS[1]} />
      </BarChart>
    </ChartBox>
  );
}
