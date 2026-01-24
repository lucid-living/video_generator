/**
 * Sidebar component for managing projects/workflows.
 */

import { useState, useEffect } from "react";
import { listWorkflows, deleteWorkflow, generateWorkflowId } from "../services/supabase";
import type { WorkflowState } from "../types/storyboard";

interface ProjectSidebarProps {
  currentWorkflowId: string | null;
  onSelectWorkflow: (workflow: WorkflowState | null) => void;
  onNewProject: () => void;
}

export function ProjectSidebar({
  currentWorkflowId,
  onSelectWorkflow,
  onNewProject,
}: ProjectSidebarProps) {
  const [workflows, setWorkflows] = useState<WorkflowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      const allWorkflows = await listWorkflows();
      setWorkflows(allWorkflows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
    // Refresh list every 5 seconds to catch updates
    const interval = setInterval(loadWorkflows, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (workflowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) {
      return;
    }

    try {
      await deleteWorkflow(workflowId);
      await loadWorkflows();
      // If deleted workflow was current, clear selection
      if (workflowId === currentWorkflowId) {
        onSelectWorkflow(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  const getProjectTitle = (workflow: WorkflowState): string => {
    return workflow.storyboard?.theme || `Project ${workflow.workflow_id.slice(-8)}`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "complete":
        return "bg-green-100 text-green-800";
      case "generation":
        return "bg-blue-100 text-blue-800";
      case "assets":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Projects</h2>
        <button
          onClick={onNewProject}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          + New Project
        </button>
      </div>

      <div className="p-2">
        {loading && (
          <div className="text-sm text-gray-500 text-center py-4">Loading...</div>
        )}

        {error && (
          <div className="text-sm text-red-600 text-center py-4">{error}</div>
        )}

        {!loading && !error && workflows.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">
            No projects yet. Create one to get started!
          </div>
        )}

        {!loading &&
          !error &&
          workflows.map((workflow) => (
            <div
              key={workflow.workflow_id}
              onClick={() => onSelectWorkflow(workflow)}
              className={`p-3 mb-2 rounded-md cursor-pointer transition-colors ${
                currentWorkflowId === workflow.workflow_id
                  ? "bg-blue-50 border-2 border-blue-500"
                  : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {getProjectTitle(workflow)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {workflow.storyboard?.style_guide || "No style guide"}
                  </p>
                  <span
                    className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                      workflow.status
                    )}`}
                  >
                    {workflow.status}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(workflow.workflow_id, e)}
                  className="ml-2 text-gray-400 hover:text-red-600 text-sm"
                  title="Delete project"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}


