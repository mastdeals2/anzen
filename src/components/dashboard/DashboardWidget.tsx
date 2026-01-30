import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface DashboardWidgetProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'yellow' | 'emerald' | 'gray';
  onClick?: () => void;
  children?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down';
  };
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    icon: 'bg-blue-100',
    border: 'border-blue-200',
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    icon: 'bg-green-100',
    border: 'border-green-200',
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    icon: 'bg-orange-100',
    border: 'border-orange-200',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    icon: 'bg-red-100',
    border: 'border-red-200',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    icon: 'bg-purple-100',
    border: 'border-purple-200',
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    icon: 'bg-yellow-100',
    border: 'border-yellow-200',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    icon: 'bg-emerald-100',
    border: 'border-emerald-200',
  },
  gray: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    icon: 'bg-gray-100',
    border: 'border-gray-200',
  },
};

export function DashboardWidget({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  onClick,
  children,
  loading = false,
  fullWidth = false,
  trend,
}: DashboardWidgetProps) {
  const colors = colorClasses[color];
  const isClickable = !!onClick;

  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg shadow border ${colors.border} p-4 animate-pulse ${
          fullWidth ? 'col-span-full' : ''
        }`}
      >
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg shadow border ${colors.border} p-4 transition-all hover:shadow-md ${
        isClickable ? 'cursor-pointer hover:scale-[1.02]' : ''
      } ${fullWidth ? 'col-span-full' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 truncate mb-1">{title}</p>

          {value !== undefined && (
            <p className={`text-2xl font-bold ${colors.text} mb-1`}>
              {typeof value === 'number'
                ? value.toLocaleString('id-ID')
                : value}
            </p>
          )}

          {subtitle && (
            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
          )}

          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-xs font-medium ${
                  trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}

          {children && <div className="mt-3">{children}</div>}
        </div>

        {Icon && (
          <div className={`${colors.icon} p-3 rounded-full flex-shrink-0 ml-3`}>
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>
        )}
      </div>
    </div>
  );
}
