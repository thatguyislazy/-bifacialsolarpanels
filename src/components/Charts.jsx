import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

export default function Charts({ data }) {
  const chartData = {
    labels: ["Before", "After"],
    datasets: [
      {
        label: "Temperature (°C)",
        data: [35, 35 - data.tempReduction],
      },
    ],
  };

  return <Line data={chartData} />;
}