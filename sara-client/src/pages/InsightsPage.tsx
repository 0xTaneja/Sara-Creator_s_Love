import React, { useState } from 'react';
import SaraInsights from '../components/SaraInsights';

const InsightsPage: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('all');

  const filters = [
    { id: 'all', label: 'All Insights' },
    { id: 'prediction', label: 'Predictions' },
    { id: 'market', label: 'Market Updates' },
    { id: 'engagement', label: 'Engagement Spikes' },
    { id: 'alert', label: 'Alerts' },
    { id: 'saved', label: 'Saved' },
  ];

  const timeRanges = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sara's Insights</h1>
            <p className="text-gray-600">
              AI-powered predictions and market insights for Creator Coins
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 border-none focus:ring-2 focus:ring-coral-DEFAULT"
            >
              {timeRanges.map((range) => (
                <option key={range.id} value={range.id}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-6">
          <SaraInsights showTitle={false} defaultFilter={activeFilter} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">About Sara's Insights</h2>
          
          <div className="prose max-w-none">
            <p>
              Sara is an AI-powered social market maker that analyzes creator engagement metrics, market trends, and social sentiment to provide real-time insights and predictions for Creator Coins.
            </p>
            
            <h3 className="text-lg font-semibold mt-4">Types of Insights</h3>
            
            <ul className="space-y-2 mt-2">
              <li className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mt-0.5">
                  🔮
                </div>
                <div>
                  <span className="font-medium">Predictions:</span> AI-powered forecasts about potential price movements based on engagement metrics and market patterns.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-coral-light bg-opacity-30 flex items-center justify-center text-coral-DEFAULT mt-0.5">
                  📊
                </div>
                <div>
                  <span className="font-medium">Market Updates:</span> Real-time information about current market conditions, price movements, and trading volumes.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mt-0.5">
                  📈
                </div>
                <div>
                  <span className="font-medium">Engagement Spikes:</span> Notifications about sudden increases in creator engagement metrics like views, likes, and subscribers.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 mt-0.5">
                  🚨
                </div>
                <div>
                  <span className="font-medium">Alerts:</span> Important notifications about significant market events, large trades, or potential risks.
                </div>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">How Sara Works</h2>
          
          <div className="prose max-w-none">
            <p>
              Sara continuously monitors YouTube engagement metrics, social media sentiment, and on-chain trading activity to generate insights. The AI analyzes patterns and correlations between creator content performance and token price movements to make predictions.
            </p>
            
            <h3 className="text-lg font-semibold mt-4">Trading Signals</h3>
            
            <ul className="space-y-2 mt-2">
              <li className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white mt-0.5">
                  BUY
                </div>
                <div>
                  <span className="font-medium">Buy Signal:</span> Sara has detected a high probability of upward price movement based on positive engagement metrics, social sentiment, and market conditions.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white mt-0.5">
                  SELL
                </div>
                <div>
                  <span className="font-medium">Sell Signal:</span> Sara has detected a high probability of downward price movement based on negative engagement metrics, social sentiment, or market conditions.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-white mt-0.5">
                  WATCH
                </div>
                <div>
                  <span className="font-medium">Watch Signal:</span> Sara has detected unusual activity or mixed signals that warrant monitoring, but not immediate action.
                </div>
              </li>
            </ul>
            
            <p className="mt-4">
              These insights are designed to help traders make more informed decisions, but they should not be considered financial advice. Always do your own research before making trading decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsPage; 