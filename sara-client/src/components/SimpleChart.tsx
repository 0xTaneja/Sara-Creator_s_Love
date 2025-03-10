import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { API_URL } from '../config';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PriceHistoryItem {
  price: number;
  timestamp: string;
}

interface SimpleChartProps {
  tokenId?: string;
  height?: number;
}

const SimpleChart: React.FC<SimpleChartProps> = ({ tokenId, height = 350 }) => {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState<boolean>(false);

  useEffect(() => {
    if (!tokenId) {
      setIsLoading(false);
      setError('No token ID provided');
      return;
    }
    
    fetchPriceHistory();
    
    // Set up polling for real-time updates (every 30 seconds)
    const pollingInterval = setInterval(fetchPriceHistory, 30000);
    
    return () => {
      clearInterval(pollingInterval);
    };
  }, [tokenId, timeframe]);

  const fetchPriceHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/tokens/${tokenId}/price-history?timeframe=${timeframe}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // No data yet, which is expected
          setHasData(false);
          setIsLoading(false);
          return;
        }
        throw new Error(`Failed to fetch price history: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data) && data.length > 0) {
        setPriceHistory(data);
        setHasData(true);
      } else {
        // No data points
        setHasData(false);
      }
    } catch (err) {
      console.error('Error fetching price history:', err);
      setError('Failed to load price history');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate price change
  const priceChange = useMemo(() => {
    if (!priceHistory || priceHistory.length < 2) {
      return { value: 0, percentage: 0 };
    }
    
    const latestPrice = priceHistory[priceHistory.length - 1].price;
    const earliestPrice = priceHistory[0].price;
    
    const change = latestPrice - earliestPrice;
    const percentageChange = (change / earliestPrice) * 100;
    
    return {
      value: change,
      percentage: percentageChange
    };
  }, [priceHistory]);

  // Prepare chart data
  const chartData = {
    labels: priceHistory.map(item => {
      const date = new Date(item.timestamp);
      
      if (timeframe === '24h') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    }),
    datasets: [
      {
        label: 'Price',
        data: priceHistory.map(item => item.price),
        borderColor: priceChange.percentage >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
          if (priceChange.percentage >= 0) {
            gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
          } else {
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.2)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
          }
          return gradient;
        },
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }
    ]
  };

  // Empty chart data for when no data is available
  const emptyChartData = {
    labels: Array(7).fill(''),
    datasets: [
      {
        label: 'Price',
        data: Array(7).fill(null),
        borderColor: 'rgba(200, 200, 200, 0.5)',
        backgroundColor: 'rgba(200, 200, 200, 0.1)',
        borderWidth: 1,
        borderDash: [5, 5],
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: hasData,
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            return `$${typeof context.raw === 'number' ? context.raw.toFixed(6) : context.raw}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          display: hasData,
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: function(value) {
            return typeof value === 'number' ? value.toFixed(6) : value;
          },
          display: hasData,
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    elements: {
      line: {
        tension: 0.4
      }
    }
  };

  const isPositive = priceChange.percentage >= 0;

  return (
    <div className="w-full">
      <div className="flex justify-between mb-4">
        <div className="flex space-x-2">
          <button 
            onClick={() => setTimeframe('24h')}
            className={`px-3 py-1 text-sm rounded-md ${timeframe === '24h' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            24h
          </button>
          <button 
            onClick={() => setTimeframe('7d')}
            className={`px-3 py-1 text-sm rounded-md ${timeframe === '7d' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            7d
          </button>
          <button 
            onClick={() => setTimeframe('30d')}
            className={`px-3 py-1 text-sm rounded-md ${timeframe === '30d' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            30d
          </button>
          <button 
            onClick={() => setTimeframe('all')}
            className={`px-3 py-1 text-sm rounded-md ${timeframe === 'all' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            All
          </button>
        </div>
        
        {hasData && (
          <div className="flex items-baseline">
            <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{priceChange.percentage.toFixed(2)}%
            </span>
            <span className="text-xs text-gray-500 ml-1">
              {timeframe === '24h' ? '24h' : 
               timeframe === '7d' ? '7d' : 
               timeframe === '30d' ? '30d' : 'all time'}
            </span>
          </div>
        )}
      </div>
      
      <div style={{ height: `${height}px`, position: 'relative' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-coral-DEFAULT"></div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
            <p className="text-red-500">{error}</p>
          </div>
        )}
        
        {!isLoading && !error && !hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-70 z-10">
            <p className="text-gray-500 text-center">No trading data available yet</p>
            <p className="text-gray-400 text-sm text-center mt-2">Chart will update automatically when trading begins</p>
          </div>
        )}
        
        <Line data={hasData ? chartData : emptyChartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default SimpleChart; 