import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  Filler,
  BarElement
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// Mock portfolio data
const mockPortfolioData = {
  totalValue: '$1,245.67',
  totalValueChange: '+$124.56',
  totalValueChangePercentage: '+11.1%',
  tokens: [
    {
      id: '1',
      name: 'MrBeast',
      symbol: 'BEAST',
      amount: '500',
      value: '$620.00',
      valueChange: '+$62.00',
      valueChangePercentage: '+11.1%',
      price: 1.24,
      priceChange: 12.5,
      imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKY455xp16s2AIHalRjK60zas-DitxAHmRjQsXPE2A=s176-c-k-c0x00ffffff-no-rj',
      address: '0x1234567890123456789012345678901234567890',
    },
    {
      id: '2',
      name: 'PewDiePie',
      symbol: 'PEWDS',
      amount: '350',
      value: '$367.50',
      valueChange: '+$18.38',
      valueChangePercentage: '+5.3%',
      price: 1.05,
      priceChange: 5.3,
      imageUrl: 'https://yt3.googleusercontent.com/5oUY3tashyxfqsjO5SGhjT4dus8FkN9CsAHwXWISFrdPYii1FudD4ICtLfuCw6-THJsJbgoY=s176-c-k-c0x00ffffff-no-rj',
      address: '0x3456789012345678901234567890123456789012',
    },
    {
      id: '3',
      name: 'Marques Brownlee',
      symbol: 'MKBHD',
      amount: '250',
      value: '$217.50',
      valueChange: '-$4.57',
      valueChangePercentage: '-2.1%',
      price: 0.87,
      priceChange: -2.1,
      imageUrl: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-kDHut3uI4MgIpWJ5xxX0n2Px8A=s176-c-k-c0x00ffffff-no-rj',
      address: '0x2345678901234567890123456789012345678901',
    },
  ],
  transactions: [
    {
      id: '1',
      type: 'buy',
      token: 'BEAST',
      amount: '200',
      price: '1.15',
      value: '$230.00',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
    {
      id: '2',
      type: 'buy',
      token: 'PEWDS',
      amount: '150',
      price: '0.98',
      value: '$147.00',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
      txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    },
    {
      id: '3',
      type: 'buy',
      token: 'MKBHD',
      amount: '100',
      price: '0.85',
      value: '$85.00',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
      txHash: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
    },
    {
      id: '4',
      type: 'buy',
      token: 'BEAST',
      amount: '300',
      price: '1.20',
      value: '$360.00',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
      txHash: '0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc',
    },
    {
      id: '5',
      type: 'buy',
      token: 'PEWDS',
      amount: '200',
      price: '1.00',
      value: '$200.00',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), // 14 days ago
      txHash: '0x567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234',
    },
    {
      id: '6',
      type: 'buy',
      token: 'MKBHD',
      amount: '150',
      price: '0.90',
      value: '$135.00',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(), // 20 days ago
      txHash: '0x90abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    },
  ],
};

// Mock portfolio performance data
const mockPerformanceData = {
  labels: ['30 Days Ago', '25 Days Ago', '20 Days Ago', '15 Days Ago', '10 Days Ago', '5 Days Ago', 'Today'],
  datasets: [
    {
      label: 'Portfolio Value (USD)',
      data: [980, 1020, 1050, 1100, 1150, 1200, 1245.67],
      borderColor: '#FF6B6B',
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
      fill: true,
      tension: 0.4,
    }
  ]
};

// Mock token allocation data
const mockAllocationData = {
  labels: ['BEAST', 'PEWDS', 'MKBHD'],
  datasets: [
    {
      data: [620, 367.5, 217.5],
      backgroundColor: [
        '#FF6B6B',
        '#4ECDC4',
        '#FFD166',
      ],
      borderWidth: 1,
    },
  ],
};

// Mock transaction history data
const mockTransactionHistoryData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [
    {
      label: 'Buy Transactions',
      data: [2, 3, 1, 4, 2, 3],
      backgroundColor: 'rgba(78, 205, 196, 0.7)',
    },
    {
      label: 'Sell Transactions',
      data: [1, 2, 0, 2, 1, 0],
      backgroundColor: 'rgba(255, 107, 107, 0.7)',
    },
  ],
};

const PortfolioPage: React.FC = () => {
  const { isConnected, account } = useWeb3();
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('holdings');
  const [performanceData, setPerformanceData] = useState(mockPerformanceData);
  const [allocationData, setAllocationData] = useState(mockAllocationData);
  const [transactionHistoryData, setTransactionHistoryData] = useState(mockTransactionHistoryData);
  const [timeRange, setTimeRange] = useState('30d');
  const [sortField, setSortField] = useState('value');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Chart options
  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: $${value} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '70%',
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Transactions'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Month'
        }
      }
    }
  };

  // Simulate fetching portfolio data
  useEffect(() => {
    const fetchPortfolioData = async () => {
      if (!isConnected || !account) return;
      
      setIsLoading(true);
      // In a real app, you would fetch data from your API or blockchain
      // For now, we'll just use a timeout to simulate loading
      setTimeout(() => {
        setPortfolioData(mockPortfolioData);
        setPerformanceData(mockPerformanceData);
        setAllocationData(mockAllocationData);
        setTransactionHistoryData(mockTransactionHistoryData);
        setIsLoading(false);
      }, 1000);
    };

    fetchPortfolioData();
  }, [isConnected, account]);

  // Function to update time range for charts
  const updateTimeRange = (range: string) => {
    setTimeRange(range);
    // In a real app, you would fetch new data based on the time range
    // For now, we'll just simulate different data
    
    if (range === '7d') {
      setPerformanceData({
        ...mockPerformanceData,
        labels: ['7 Days Ago', '6 Days Ago', '5 Days Ago', '4 Days Ago', '3 Days Ago', '2 Days Ago', 'Today'],
        datasets: [{
          ...mockPerformanceData.datasets[0],
          data: [1150, 1170, 1190, 1210, 1220, 1230, 1245.67],
        }]
      });
    } else if (range === '30d') {
      setPerformanceData(mockPerformanceData);
    } else if (range === '90d') {
      setPerformanceData({
        ...mockPerformanceData,
        labels: ['90 Days Ago', '75 Days Ago', '60 Days Ago', '45 Days Ago', '30 Days Ago', '15 Days Ago', 'Today'],
        datasets: [{
          ...mockPerformanceData.datasets[0],
          data: [800, 850, 900, 950, 1050, 1150, 1245.67],
        }]
      });
    }
  };

  // Function to sort tokens
  const sortTokens = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sorted and filtered tokens
  const getFilteredAndSortedTokens = () => {
    if (!portfolioData) return [];
    
    let filteredTokens = [...portfolioData.tokens];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredTokens = filteredTokens.filter(token => 
        token.name.toLowerCase().includes(query) || 
        token.symbol.toLowerCase().includes(query)
      );
    }
    
    // Apply type filter
    if (filterType === 'positive') {
      filteredTokens = filteredTokens.filter(token => token.priceChange >= 0);
    } else if (filterType === 'negative') {
      filteredTokens = filteredTokens.filter(token => token.priceChange < 0);
    }
    
    // Apply sorting
    filteredTokens.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'amount':
          aValue = parseFloat(a.amount);
          bValue = parseFloat(b.amount);
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'value':
          aValue = parseFloat(a.value.replace('$', '').replace(',', ''));
          bValue = parseFloat(b.value.replace('$', '').replace(',', ''));
          break;
        case 'change':
          aValue = parseFloat(a.valueChangePercentage.replace('%', '').replace('+', ''));
          bValue = parseFloat(b.valueChangePercentage.replace('%', '').replace('+', ''));
          break;
        default:
          aValue = parseFloat(a.value.replace('$', '').replace(',', ''));
          bValue = parseFloat(b.value.replace('$', '').replace(',', ''));
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filteredTokens;
  };

  // Format date
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format transaction hash for display
  const formatTxHash = (hash: string) => {
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
  };

  // Get sort indicator
  const getSortIndicator = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
        <p className="text-gray-600 mb-6 text-center max-w-md">
          Connect your wallet to view your portfolio and transaction history.
        </p>
        <button className="btn btn-primary px-8 py-3">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-coral-DEFAULT"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Portfolio Overview */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Portfolio</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-2xl font-bold text-coral-DEFAULT">{portfolioData?.totalValue}</p>
            <p className={`text-sm ${portfolioData?.totalValueChangePercentage.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
              {portfolioData?.totalValueChangePercentage} ({portfolioData?.totalValueChange})
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Total Tokens</p>
            <p className="text-2xl font-bold text-coral-DEFAULT">{portfolioData?.tokens.length}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Total Transactions</p>
            <p className="text-2xl font-bold text-coral-DEFAULT">{portfolioData?.transactions.length}</p>
          </div>
        </div>
        
        {/* Portfolio Performance Chart */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Portfolio Performance</h2>
            <div className="flex space-x-2">
              <button 
                onClick={() => updateTimeRange('7d')}
                className={`px-3 py-1 text-sm rounded-md ${timeRange === '7d' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                7d
              </button>
              <button 
                onClick={() => updateTimeRange('30d')}
                className={`px-3 py-1 text-sm rounded-md ${timeRange === '30d' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                30d
              </button>
              <button 
                onClick={() => updateTimeRange('90d')}
                className={`px-3 py-1 text-sm rounded-md ${timeRange === '90d' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                90d
              </button>
            </div>
          </div>
          <div className="h-64">
            <Line options={lineChartOptions} data={performanceData} />
          </div>
        </div>
        
        {/* Portfolio Allocation Chart */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Token Allocation</h2>
            <div className="h-64">
              <Doughnut options={doughnutOptions} data={allocationData} />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Transaction History</h2>
            <div className="h-64">
              <Bar options={barChartOptions} data={transactionHistoryData} />
            </div>
          </div>
        </div>
        
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('holdings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'holdings'
                  ? 'border-coral-DEFAULT text-coral-DEFAULT'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Holdings
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'transactions'
                  ? 'border-coral-DEFAULT text-coral-DEFAULT'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Transactions
            </button>
          </nav>
        </div>
        
        {activeTab === 'holdings' && (
          <div>
            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div className="flex space-x-2">
                <button 
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1 text-sm rounded-md ${filterType === 'all' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  All
                </button>
                <button 
                  onClick={() => setFilterType('positive')}
                  className={`px-3 py-1 text-sm rounded-md ${filterType === 'positive' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Positive
                </button>
                <button 
                  onClick={() => setFilterType('negative')}
                  className={`px-3 py-1 text-sm rounded-md ${filterType === 'negative' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Negative
                </button>
              </div>
              <div className="w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search tokens..."
                  className="px-4 py-2 border border-gray-300 rounded-md w-full md:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => sortTokens('name')}
                    >
                      Token {getSortIndicator('name')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => sortTokens('amount')}
                    >
                      Amount {getSortIndicator('amount')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => sortTokens('price')}
                    >
                      Price {getSortIndicator('price')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => sortTokens('value')}
                    >
                      Value {getSortIndicator('value')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => sortTokens('change')}
                    >
                      Change {getSortIndicator('change')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredAndSortedTokens().map((token: any) => (
                    <tr key={token.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img className="h-10 w-10 rounded-full" src={token.imageUrl} alt={token.name} />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{token.name}</div>
                            <div className="text-sm text-gray-500">${token.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{token.amount}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">${token.price.toFixed(2)}</div>
                        <div className={`text-xs ${token.priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {token.priceChange >= 0 ? '+' : ''}{token.priceChange}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{token.value}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${token.valueChangePercentage.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                          {token.valueChangePercentage}
                        </div>
                        <div className={`text-xs ${token.valueChangePercentage.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                          {token.valueChange}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex mt-2">
                          <Link to={`/token/${token.id}`} className="text-coral-DEFAULT hover:text-coral-dark mr-4">
                            Details
                          </Link>
                          <Link to={`/swap?token=${token.id}`} className="text-coral-DEFAULT hover:text-coral-dark">
                            Trade
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 'transactions' && (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Token
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tx Hash
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {portfolioData?.transactions.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(tx.timestamp)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          tx.type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">${tx.token}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{tx.amount}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">${tx.price}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{tx.value}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a
                          href={`https://etherscan.io/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-coral-DEFAULT hover:text-coral-dark"
                        >
                          {formatTxHash(tx.txHash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioPage; 