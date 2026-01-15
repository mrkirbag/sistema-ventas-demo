import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
Chart.register(ChartDataLabels);

export function renderChart(canvasId, labels, values) {

    const reportesParent = document.getElementById("reportes");
    const container = document.createElement("div");
    
    container.style.width = "100%";
    container.style.height = "100%";      
    container.style.maxWidth = "500px"; 
    container.style.maxHeight = "400px";    
    container.style.position = "relative"; 

    const canvas = document.createElement("canvas");
    canvas.id = canvasId;

    container.appendChild(canvas);
    reportesParent.appendChild(container);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("No se pudo obtener el contexto 2D del canvas");
        return;
    }

    function getRandomColor() {

        const h = Math.floor(Math.random() * (300 - 180 + 1) + 180);
        const s = Math.floor(Math.random() * (80 - 60 + 1) + 60);
        const l = Math.floor(Math.random() * (70 - 50 + 1) + 50);

        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: null,
                data: values,
                backgroundColor: values.map(() => getRandomColor()),
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    text: canvasId,
                    color: "#000"
                },
                datalabels: {
                    anchor: 'center',   
                    align: 'center',   
                    color: '#fff', 
                    font: {
                        weight: 'bold'
                    },
                    formatter: (value) => value
                }
            },
            layout: {
                padding: {
                    top: 5
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "#000" }
                },
                x: {
                    ticks: {
                        display: false // oculta los nombres
                    },
                    grid: {
                        display: false // opcional: oculta las líneas del eje X
                    }
                },
            }
        },
    });
}