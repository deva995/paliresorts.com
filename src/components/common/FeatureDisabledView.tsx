import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getDefaultDashboardRoute } from '../../utils/rbac';

interface FeatureDisabledViewProps {
  featureName: string;
  description?: string;
}

export const FeatureDisabledView: React.FC<FeatureDisabledViewProps> = ({
  featureName,
  description = 'This module is not enabled in the current release.'
}) => {
  const { effectiveRole, pushRoute } = useApp();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-6 shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        {featureName} Not Available
      </h2>
      <p className="text-slate-600 max-w-md mb-8 leading-relaxed">
        Module not available in current release. {description}
      </p>
      <button
        onClick={() => pushRoute(getDefaultDashboardRoute(effectiveRole))}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#163024] text-white font-medium hover:bg-[#163024]/90 transition shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Dashboard
      </button>
    </div>
  );
};
