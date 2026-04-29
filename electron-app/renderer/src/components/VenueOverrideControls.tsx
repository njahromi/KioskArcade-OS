import React, { useState } from 'react';
import { DoorOpen, CalendarClock, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

interface VenueOverrideControlsProps {
  readonly sessionPassword: string;
  readonly venueEnabled: boolean;
  readonly venueOverride: 'none' | 'force_open';
  readonly onLogout: () => void;
  readonly onVenueChanged: () => void;
}

const VenueOverrideControls: React.FC<VenueOverrideControlsProps> = ({
  sessionPassword,
  venueEnabled,
  venueOverride,
  onLogout,
  onVenueChanged
}) => {
  const [busy, setBusy] = useState(false);

  const forceOpen = async () => {
    setBusy(true);
    try {
      const ok = await window.electronAPI.venue.setOverride(sessionPassword, 'force_open');
      if (ok) {
        toast.success('Venue is forced open for guests.');
        onVenueChanged();
      } else {
        toast.error('Could not apply override. Check the administrator password.');
      }
    } finally {
      setBusy(false);
    }
  };

  const resumeSchedule = async () => {
    setBusy(true);
    try {
      const ok = await window.electronAPI.venue.setOverride(sessionPassword, 'none');
      if (ok) {
        toast.success('Venue follows the configured schedule again.');
        onVenueChanged();
      } else {
        toast.error('Could not clear override.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-4 text-emerald-100 text-sm">
        You are signed in as administrator. Session ends when you log out or return to games.
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">Venue hours</h3>
        {!venueEnabled ? (
          <p className="text-gray-400 text-sm">
            Venue scheduling is turned off in application configuration. Enable <code className="text-gray-300">venue.enabled</code> to use closed hours and overrides.
          </p>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-4">
              When the schedule says the arcade is closed, guests normally see a closed screen and cannot launch
              games. Use force open for late events or emergencies; clear it to return to the schedule.
            </p>
            <p className="text-sm text-gray-300 mb-4">
              Current override:{' '}
              <span className="font-mono text-amber-300">
                {venueOverride === 'force_open' ? 'force_open' : 'none'}
              </span>
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || venueOverride === 'force_open'}
                onClick={() => void forceOpen()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-medium"
              >
                <DoorOpen size={18} />
                Force public open
              </button>
              <button
                type="button"
                disabled={busy || venueOverride === 'none'}
                onClick={() => void resumeSchedule()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white font-medium"
              >
                <CalendarClock size={18} />
                Resume schedule
              </button>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm"
      >
        <LogOut size={16} />
        End admin session
      </button>
    </div>
  );
};

export default VenueOverrideControls;
