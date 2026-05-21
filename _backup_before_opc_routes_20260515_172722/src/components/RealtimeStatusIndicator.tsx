import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

type StatusType = 'connected' | 'disconnected' | 'syncing';

interface RealtimeStatusIndicatorProps {
  status: StatusType;
}

export default function RealtimeStatusIndicator({ status }: RealtimeStatusIndicatorProps) {
  const getStatusConfig = (status: StatusType) => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-500',
          pulseColor: 'bg-green-400',
          text: 'Connected',
          description: 'Real-time updates active',
          animate: false,
        };
      case 'syncing':
        return {
          color: 'bg-[#1A1A1A]',
          pulseColor: 'bg-[#1A1A1A]/50',
          text: 'Syncing',
          description: 'Syncing updates...',
          animate: true,
        };
      case 'disconnected':
        return {
          color: 'bg-red-500',
          pulseColor: 'bg-red-400',
          text: 'Offline',
          description: 'Connection lost',
          animate: false,
        };
      default:
        return {
          color: 'bg-gray-400',
          pulseColor: 'bg-gray-300',
          text: 'Unknown',
          description: 'Status unknown',
          animate: false,
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            {/* Status Indicator */}
            <div className="relative flex items-center justify-center">
              {/* Pulse ring (for syncing state) */}
              {config.animate && (
                <span className="absolute inline-flex h-3 w-3 animate-ping opacity-75">
                  <span className={`absolute inline-flex h-full w-full rounded-full ${config.pulseColor}`} />
                </span>
              )}
              {/* Dot */}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${config.color}`} />
            </div>
            
            {/* Optional: Status text (can be removed if you want just the dot) */}
            <span className="text-xs font-medium text-[#6B6B6B] hidden sm:inline">
              {config.text}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-[#1A1A1A] text-[#FFFFFF] border-[#333333]">
          <div className="text-center">
            <p className="font-semibold text-sm">{config.text}</p>
            <p className="text-xs text-[#9A9A9A] mt-0.5">{config.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

