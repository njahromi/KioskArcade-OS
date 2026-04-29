import React from 'react';
import { Clock, LogIn } from 'lucide-react';

interface ClosedVenueScreenProps {
  readonly title: string;
  readonly subtitle: string;
  readonly locationName?: string;
  readonly onStaffLogin: () => void;
}

const ClosedVenueScreen: React.FC<ClosedVenueScreenProps> = ({
  title,
  subtitle,
  locationName,
  onStaffLogin
}) => {
  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center text-center px-6">
      <Clock className="text-slate-500 mb-6" size={72} strokeWidth={1.25} />
      {locationName && (
        <p className="text-slate-500 text-sm uppercase tracking-wide mb-2">{locationName}</p>
      )}
      <h2 className="text-4xl font-bold text-white mb-4 max-w-xl">{title}</h2>
      <p className="text-lg text-slate-400 max-w-lg mb-10">{subtitle}</p>
      <button
        type="button"
        onClick={onStaffLogin}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium border border-slate-600"
      >
        <LogIn size={20} />
        Staff login
      </button>
      <p className="mt-8 text-xs text-slate-600 max-w-md">
        Authorized staff can open the Admin tab and use &quot;Force public open&quot; after signing in with the
        administrator password.
      </p>
    </div>
  );
};

export default ClosedVenueScreen;
