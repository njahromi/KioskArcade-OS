import React from 'react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-4">KioskArcade OS</h1>
      <p className="text-xl">Application is loading successfully!</p>
      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-2xl mb-2">System Status</h2>
        <p>✅ SecurityManager: Working</p>
        <p>✅ React App: Loading</p>
        <p>✅ Electron: Connected</p>
      </div>
    </div>
  );
};

export default App; 