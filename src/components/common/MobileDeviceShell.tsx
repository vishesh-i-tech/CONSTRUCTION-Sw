import React from 'react';

interface MobileDeviceShellProps {
  children: React.ReactNode;
}

export const MobileDeviceShell: React.FC<MobileDeviceShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-[#f4f7fc] dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col selection:bg-blue-600/30">
      {/* Full-width responsive content canvas - no dark borders, no simulator frame */}
      <main className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-2 sm:px-4 md:px-6 py-2 sm:py-4">
        {children}
      </main>
    </div>
  );
};
