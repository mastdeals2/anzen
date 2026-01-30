import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { CheckCircle2, Clock, AlertCircle, ClipboardList } from 'lucide-react';

interface TasksSummary {
  my_tasks: number;
  overdue_tasks: number;
  today_tasks: number;
  pending_approvals: number;
  recent_tasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    deadline: string;
    task_type: string;
  }>;
}

export function TasksSummaryWidget() {
  const { profile } = useAuth();
  const { setCurrentPage } = useNavigation();
  const [summary, setSummary] = useState<TasksSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadTasksSummary();
    }
  }, [profile?.id]);

  const loadTasksSummary = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_user_tasks_summary', {
        p_user_id: profile.id,
      });

      if (error) throw error;
      setSummary(data);
    } catch (error) {
      console.error('Error loading tasks summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const taskCards = [
    {
      title: 'My Tasks',
      value: summary.my_tasks,
      icon: ClipboardList,
      color: 'blue',
      onClick: () => setCurrentPage('tasks'),
    },
    {
      title: 'Overdue',
      value: summary.overdue_tasks,
      icon: AlertCircle,
      color: 'red',
      onClick: () => setCurrentPage('tasks'),
    },
    {
      title: 'Due Today',
      value: summary.today_tasks,
      icon: Clock,
      color: 'orange',
      onClick: () => setCurrentPage('tasks'),
    },
    {
      title: 'Approvals',
      value: summary.pending_approvals,
      icon: CheckCircle2,
      color: 'purple',
      onClick: () => setCurrentPage('approvals'),
    },
  ];

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Tasks & Actions</h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {taskCards.map((card, index) => {
          const Icon = card.icon;
          const bgColor = card.color === 'blue' ? 'bg-blue-50' :
                         card.color === 'red' ? 'bg-red-50' :
                         card.color === 'orange' ? 'bg-orange-50' : 'bg-purple-50';
          const textColor = card.color === 'blue' ? 'text-blue-600' :
                           card.color === 'red' ? 'text-red-600' :
                           card.color === 'orange' ? 'text-orange-600' : 'text-purple-600';

          return (
            <div
              key={index}
              className={`${bgColor} rounded-lg p-3 cursor-pointer hover:shadow-md transition`}
              onClick={card.onClick}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${textColor}`} />
                <p className="text-xs font-medium text-gray-600">{card.title}</p>
              </div>
              <p className={`text-2xl font-bold ${textColor}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      {summary.recent_tasks.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Tasks</h4>
          <div className="space-y-2">
            {summary.recent_tasks.map((task) => {
              const isOverdue = new Date(task.deadline) < new Date();
              return (
                <div
                  key={task.id}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer border border-gray-200"
                  onClick={() => setCurrentPage('tasks')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            priorityColors[task.priority] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span
                          className={`text-xs ${
                            isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'
                          }`}
                        >
                          {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {isOverdue && (
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.recent_tasks.length === 0 && (
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">All caught up!</p>
          <p className="text-xs text-gray-500 mt-1">No pending tasks</p>
        </div>
      )}
    </div>
  );
}
