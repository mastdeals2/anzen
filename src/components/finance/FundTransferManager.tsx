import React from 'react';

interface FundTransferManagerProps {
  canManage: boolean;
}

export const FundTransferManager: React.FC<FundTransferManagerProps> = ({ canManage }) => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Fund Transfer Manager</h2>
      <p className="text-gray-600">Fund transfer functionality coming soon.</p>
    </div>
  );
};
