import React from 'react';
import { Activity, Wifi, HardDrive, Clock } from 'lucide-react';

interface SystemStatusProps {
  systemInfo: {
    arcadeId: string;
    locationId: string;
    locationName: string;
    uptime: number;
    gamesInstalled: number;
    lastSync: string;
  };
}

const SystemStatus: React.FC<SystemStatusProps> = ({ systemInfo }) => {
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatLastSync = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="system-status">
      <h2 className="text-2xl font-bold mb-6">System Status</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Arcade Info */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <Activity className="w-6 h-6 text-blue-400 mr-3" />
            <h3 className="text-lg font-semibold">Arcade Information</h3>
          </div>
          <div className="space-y-2">
            <p><span className="text-gray-400">ID:</span> {systemInfo.arcadeId}</p>
            <p><span className="text-gray-400">Location:</span> {systemInfo.locationName}</p>
            <p><span className="text-gray-400">Location ID:</span> {systemInfo.locationId}</p>
          </div>
        </div>

        {/* System Stats */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <HardDrive className="w-6 h-6 text-green-400 mr-3" />
            <h3 className="text-lg font-semibold">System Stats</h3>
          </div>
          <div className="space-y-2">
            <p><span className="text-gray-400">Uptime:</span> {formatUptime(systemInfo.uptime)}</p>
            <p><span className="text-gray-400">Games Installed:</span> {systemInfo.gamesInstalled}</p>
            <p><span className="text-gray-400">Last Sync:</span> {formatLastSync(systemInfo.lastSync)}</p>
          </div>
        </div>

        {/* Network Status */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center mb-4">
            <Wifi className="w-6 h-6 text-yellow-400 mr-3" />
            <h3 className="text-lg font-semibold">Network Status</h3>
          </div>
          <div className="space-y-2">
            <p><span className="text-gray-400">Connection:</span> <span className="text-green-400">Online</span></p>
            <p><span className="text-gray-400">Last Check:</span> <span className="text-gray-300">{new Date().toLocaleTimeString()}</span></p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex space-x-4">
          <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            Sync Games
          </button>
          <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            System Check
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus; 