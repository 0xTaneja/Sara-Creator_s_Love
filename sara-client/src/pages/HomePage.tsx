import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import CreatorTokenCard from '../components/CreatorTokenCard';
import HeroSection from '../components/HeroSection';

// Mock data for creator tokens
const mockCreatorTokens = [
  {
    id: '1',
    name: 'MrBeast',
    symbol: 'BEAST',
    price: 1.24,
    priceChange: 12.5,
    views: '5M',
    likes: '300K',
    subscribers: '250M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKY455xp16s2AIHalRjK60zas-DitxAHmRjQsXPE2A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x1234567890123456789012345678901234567890',
  },
  {
    id: '2',
    name: 'Marques Brownlee',
    symbol: 'MKBHD',
    price: 0.87,
    priceChange: -2.1,
    views: '1.2M',
    likes: '100K',
    subscribers: '18M',
    imageUrl: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-kDHut3uI4MgIpWJ5xxX0n2Px8A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x2345678901234567890123456789012345678901',
  },
  {
    id: '3',
    name: 'PewDiePie',
    symbol: 'PEWDS',
    price: 1.05,
    priceChange: 5.3,
    views: '3.5M',
    likes: '250K',
    subscribers: '111M',
    imageUrl: 'https://yt3.googleusercontent.com/5oUY3tashyxfqsjO5SGhjT4dus8FkN9CsAHwXWISFrdPYii1FudD4ICtLfuCw6-THJsJbgoY=s176-c-k-c0x00ffffff-no-rj',
    address: '0x3456789012345678901234567890123456789012',
  },
  {
    id: '4',
    name: 'Logan Paul',
    symbol: 'LOGAN',
    price: 0.65,
    priceChange: -1.2,
    views: '2.1M',
    likes: '150K',
    subscribers: '23M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZWeMCsx4Q9e_Hm6VKOOOcl3MPTAzqRMfC0GNjm=s176-c-k-c0x00ffffff-no-rj',
    address: '0x4567890123456789012345678901234567890123',
  },
  {
    id: '5',
    name: 'KSI',
    symbol: 'KSI',
    price: 0.92,
    priceChange: 3.7,
    views: '2.8M',
    likes: '180K',
    subscribers: '24M',
    imageUrl: 'https://yt3.googleusercontent.com/zSgb9auUHE_rAkWLmxqRQPGzGHJBYS7J1-Jjk9RTBTJZlYwLqGQmY5yMZ5KmeYlOTvEFYUTjGQ=s176-c-k-c0x00ffffff-no-rj',
    address: '0x5678901234567890123456789012345678901234',
  },
  {
    id: '6',
    name: 'Linus Tech Tips',
    symbol: 'LTT',
    price: 0.78,
    priceChange: 2.3,
    views: '1.9M',
    likes: '120K',
    subscribers: '15M',
    imageUrl: 'https://yt3.googleusercontent.com/Vy6KL7EM_apxPSxF0pPy5w_c87YDTOlBQo3MADDF0Wl78QjuM7JdNRTG8PVLWbXKQmqJoEd-=s176-c-k-c0x00ffffff-no-rj',
    address: '0x6789012345678901234567890123456789012345',
  },
  {
    id: '7',
    name: 'David Dobrik',
    symbol: 'DOBRIK',
    price: 0.83,
    priceChange: -0.8,
    views: '2.4M',
    likes: '190K',
    subscribers: '18M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKbXBW-XdPNvlqOeQwWdUEEkQd7sNDXzrzGMl_B2=s176-c-k-c0x00ffffff-no-rj',
    address: '0x7890123456789012345678901234567890123456',
  },
  {
    id: '8',
    name: 'Emma Chamberlain',
    symbol: 'EMMA',
    price: 0.95,
    priceChange: 4.2,
    views: '1.8M',
    likes: '210K',
    subscribers: '12M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZLzqmOzPiUZScJzwHGcZV7mDnGS0-2bqqEFSFC=s176-c-k-c0x00ffffff-no-rj',
    address: '0x8901234567890123456789012345678901234567',
  },
  {
    id: '9',
    name: 'Casey Neistat',
    symbol: 'CASEY',
    price: 0.71,
    priceChange: 1.9,
    views: '1.5M',
    likes: '130K',
    subscribers: '12.5M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKbWy9-9-_BUEi8UuQQnqZSjsLcT9uKESw_O7YR7=s176-c-k-c0x00ffffff-no-rj',
    address: '0x9012345678901234567890123456789012345678',
  },
];

const HomePage: React.FC = () => {
  const { isConnected } = useWeb3();
  const [creatorTokens, setCreatorTokens] = useState(mockCreatorTokens);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate fetching data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      // In a real app, you would fetch data from your API or blockchain
      // For now, we'll just use a timeout to simulate loading
      setTimeout(() => {
        setCreatorTokens(mockCreatorTokens);
        setIsLoading(false);
      }, 1000);
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-10">
      <HeroSection />
      
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Featured Creators</h2>
          <Link to="/swap" className="text-coral-DEFAULT hover:text-coral-dark font-medium">
            View All
          </Link>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-coral-DEFAULT"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creatorTokens.slice(0, 8).map((token) => (
              <CreatorTokenCard key={token.id} token={token} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage; 