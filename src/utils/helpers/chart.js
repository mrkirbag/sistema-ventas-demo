import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { getColores, paletaGraficos, colorRgba } from "@/utils/tema";

Chart.register(ChartDataLabels);

const BRAND_COLORS = paletaGraficos();
const BRAND_BORDERS = BRAND_COLORS.map((c) => c.replace(/[\d.]+\)$/, "1)"));
const COLOR_SECUNDARIO = getColores().secundario;
const COLOR_PRIMARIO_RGBA = colorRgba(getColores().primario, 0.94);
const COLOR_TEXTO = colorRgba(getColores().primario, 0.55);
const COLOR_GRILLA = colorRgba(getColores().primario, 0.08);

function truncateLabel(label, max = 22) {
    if (!label || label.length <= max) return label;
    return `${label.slice(0, max - 1)}…`;
}

function getColors(count) {
    return Array.from({ length: count }, (_, i) => BRAND_COLORS[i % BRAND_COLORS.length]);
}

function getBorders(count) {
    return Array.from({ length: count }, (_, i) => BRAND_BORDERS[i % BRAND_BORDERS.length]);
}

function shouldUseHorizontal(labels) {
    return labels.some((label) => String(label).length > 14) || labels.length > 6;
}

function getChartHeight(labels, horizontal, compact) {
    if (compact) {
        return Math.min(Math.max(96, labels.length * 30 + 16), 200);
    }
    if (!horizontal) return 320;
    return Math.min(Math.max(260, labels.length * 52 + 48), 520);
}

export function destroyCharts(containerId = "reportes") {
    const parent = document.getElementById(containerId);
    if (!parent) return;

    parent.querySelectorAll("canvas").forEach((canvas) => {
        const instance = Chart.getChart(canvas);
        if (instance) instance.destroy();
    });

    parent.innerHTML = "";
}

export function renderChart(title, labels, values, options = {}) {
    const containerId = options.containerId || "reportes";
    const parent = document.getElementById(containerId);

    if (!parent) {
        console.error(`No se encontró el contenedor #${containerId}`);
        return null;
    }

    if (!Array.isArray(labels) || !Array.isArray(values) || labels.length === 0 || values.length === 0) {
        return null;
    }

    const compact = options.compact ?? false;
    const hideTitle = options.hideTitle ?? compact;
    const type = options.type || "bar";
    const isRound = type === "doughnut" || type === "pie";
    const horizontal = isRound ? false : (options.horizontal ?? (compact ? true : shouldUseHorizontal(labels)));
    const chartHeight = isRound
        ? (compact ? 188 : 280)
        : getChartHeight(labels, horizontal, compact);
    const displayLabels = labels.map((label) => truncateLabel(String(label), compact ? 16 : 22));
    const colors = getColors(values.length);
    const borders = getBorders(values.length);

    const wrapper = document.createElement("article");
    wrapper.className = compact ? "chart-widget" : "chart-card";

    if (!hideTitle) {
        const heading = document.createElement("h3");
        heading.className = "chart-title";
        heading.textContent = title;
        wrapper.appendChild(heading);
    }

    const chartBox = document.createElement("div");
    chartBox.className = compact ? "chart-container chart-container--compact" : "chart-container";
    chartBox.style.height = `${chartHeight}px`;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", title);

    chartBox.appendChild(canvas);
    wrapper.appendChild(chartBox);
    parent.appendChild(wrapper);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("No se pudo obtener el contexto 2D del canvas");
        return null;
    }

    const valueLabel = options.valueLabel || "";
    const hasZeros = values.some((value) => Number(value) === 0);

    const chart = new Chart(ctx, {
        type: isRound ? type : "bar",
        data: {
            labels: displayLabels,
            datasets: [
                {
                    label: valueLabel || title,
                    data: values,
                    backgroundColor: colors,
                    borderColor: isRound ? "#ffffff" : borders,
                    borderWidth: isRound ? 2 : 1,
                    borderRadius: compact ? 6 : horizontal ? 8 : { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 },
                    borderSkipped: false,
                    maxBarThickness: compact ? (horizontal ? 18 : 44) : horizontal ? 36 : 56,
                    minBarLength: !isRound && compact && hasZeros ? 10 : 0,
                },
            ],
        },
        options: {
            indexAxis: horizontal ? "y" : "x",
            responsive: true,
            maintainAspectRatio: false,
            cutout: isRound && type === "doughnut" ? "62%" : undefined,
            animation: {
                duration: compact ? 500 : 700,
                easing: "easeOutQuart",
            },
            plugins: {
                legend: {
                    display: isRound,
                    position: "bottom",
                    labels: {
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 12,
                        color: COLOR_TEXTO,
                        font: { family: "'Roboto', sans-serif", size: 11, weight: "700" },
                    },
                },
                tooltip: {
                    backgroundColor: COLOR_PRIMARIO_RGBA,
                    titleColor: "#ffffff",
                    bodyColor: "rgba(255, 255, 255, 0.92)",
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        title: (items) => labels[items[0]?.dataIndex] ?? items[0]?.label ?? "",
                        label: (item) => {
                            const value = isRound
                                ? item.parsed
                                : item.parsed[horizontal ? "x" : "y"];
                            return valueLabel ? `${valueLabel}: ${value}` : `Valor: ${value}`;
                        },
                    },
                },
                datalabels: {
                    display: true,
                    anchor: isRound ? "center" : compact && horizontal ? "end" : "end",
                    align: isRound ? "center" : compact && horizontal ? "end" : "end",
                    offset: isRound ? 0 : compact ? 2 : 4,
                    color: isRound
                        ? "#ffffff"
                        : compact && horizontal ? COLOR_SECUNDARIO : horizontal ? COLOR_SECUNDARIO : "#ffffff",
                    font: {
                        family: "'Roboto', sans-serif",
                        weight: "700",
                        size: compact ? 10 : 11,
                    },
                    formatter: (value) => (isRound && Number(value) <= 0 ? "" : value),
                    clip: false,
                },
            },
            layout: {
                padding: compact
                    ? { top: 0, right: horizontal ? 20 : 4, bottom: isRound ? 4 : 0, left: 0 }
                    : {
                          top: 8,
                          right: horizontal ? 24 : 8,
                          bottom: 4,
                          left: horizontal ? 8 : 4,
                      },
            },
            scales: isRound
                ? { x: { display: false }, y: { display: false } }
                : {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: COLOR_GRILLA,
                            drawBorder: false,
                            display: horizontal && !compact,
                        },
                        ticks: {
                            color: COLOR_TEXTO,
                            font: { family: "'Roboto', sans-serif", size: compact ? 10 : 11 },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: compact ? 4 : 8,
                            display: horizontal && !compact,
                        },
                    },
                    y: {
                        beginAtZero: !horizontal,
                        grid: {
                            color: COLOR_GRILLA,
                            drawBorder: false,
                            display: !horizontal && !compact,
                        },
                        ticks: {
                            color: COLOR_TEXTO,
                            font: { family: "'Roboto', sans-serif", size: compact ? 10 : 11 },
                            autoSkip: !horizontal,
                            padding: compact ? 4 : 8,
                        },
                    },
                },
        },
    });

    return chart;
}
