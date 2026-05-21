/**
 * React Hooks for Project Management
 * Provides easy-to-use hooks for all project operations
 */

import { useState, useEffect } from 'react';
import {
  listProjects,
  listClientProjects,
  getProject,
  updateProject,
  listProjectFiles,
  uploadProjectFile,
  projectLinkFile,
  getProjectChat,
  sendProjectMessage,
  getProjectInvoices,
  getProjectPayments,
  getProjectMilestones,
  updateMilestoneStatus,
  getCurrentClientId,
  type Project,
  type ProjectFile,
  type ProjectMessage,
  type ProjectInvoice,
  type ProjectPayment,
  type ProjectMilestone,
} from '../lib/supabase-projects';

// ==========================================
// PROJECT LIST HOOKS
// ==========================================

/**
 * Hook to list all projects (Admin/Owner)
 */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listProjects();
      setProjects(data);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return { projects, loading, error, refresh: loadProjects };
}

/**
 * Hook to list projects for current client
 */
export function useClientProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const clientId = await getCurrentClientId();
      const data = await listClientProjects(clientId);
      setProjects(data);
    } catch (err: any) {
      console.error('Failed to load client projects:', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return { projects, loading, error, refresh: loadProjects };
}

/**
 * Hook to get single project details
 */
export function useProject(projectId: string | null) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProject = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getProject(projectId);
      setProject(data);
    } catch (err: any) {
      console.error('Failed to load project:', err);
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const update = async (updates: Partial<Project>) => {
    if (!projectId) return;
    
    try {
      const updated = await updateProject(projectId, updates);
      setProject(updated);
      return updated;
    } catch (err: any) {
      console.error('Failed to update project:', err);
      throw err;
    }
  };

  return { project, loading, error, refresh: loadProject, update };
}

// ==========================================
// PROJECT FILES HOOKS
// ==========================================

/**
 * Hook to manage project files
 */
export function useProjectFiles(projectId: string | null) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await listProjectFiles(projectId);
      setFiles(data);
    } catch (err: any) {
      console.error('Failed to load project files:', err);
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [projectId]);

  const uploadFile = async (filename: string, parentId?: string) => {
    if (!projectId) return;
    
    try {
      await uploadProjectFile(projectId, filename, parentId);
      await loadFiles(); // Refresh list
    } catch (err: any) {
      console.error('Failed to upload file:', err);
      throw err;
    }
  };

  const linkFile = async (clientFileId: string) => {
    if (!projectId) return;
    
    try {
      await projectLinkFile(projectId, clientFileId);
      await loadFiles(); // Refresh list
    } catch (err: any) {
      console.error('Failed to link file:', err);
      throw err;
    }
  };

  return { files, loading, error, refresh: loadFiles, uploadFile, linkFile };
}

// ==========================================
// PROJECT CHAT HOOKS
// ==========================================

/**
 * Hook to manage project chat/messages
 */
export function useProjectChat(projectId: string | null) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getProjectChat(projectId);
      setMessages(data);
    } catch (err: any) {
      console.error('Failed to load project messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [projectId]);

  const sendMessage = async (message: string, isInternal: boolean = false) => {
    if (!projectId) return;
    
    try {
      await sendProjectMessage(projectId, message, isInternal);
      await loadMessages(); // Refresh list
    } catch (err: any) {
      console.error('Failed to send message:', err);
      throw err;
    }
  };

  return { messages, loading, error, refresh: loadMessages, sendMessage };
}

// ==========================================
// PROJECT FINANCES HOOKS
// ==========================================

/**
 * Hook to manage project invoices
 */
export function useProjectInvoices(projectId: string | null) {
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getProjectInvoices(projectId);
      setInvoices(data);
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [projectId]);

  return { invoices, loading, error, refresh: loadInvoices };
}

/**
 * Hook to manage project payments
 */
export function useProjectPayments(projectId: string | null) {
  const [payments, setPayments] = useState<ProjectPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getProjectPayments(projectId);
      setPayments(data);
    } catch (err: any) {
      console.error('Failed to load payments:', err);
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [projectId]);

  return { payments, loading, error, refresh: loadPayments };
}

// ==========================================
// PROJECT MILESTONES HOOKS
// ==========================================

/**
 * Hook to manage project milestones
 */
export function useProjectMilestones(projectId: string | null) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMilestones = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getProjectMilestones(projectId);
      setMilestones(data);
    } catch (err: any) {
      console.error('Failed to load milestones:', err);
      setError(err.message || 'Failed to load milestones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMilestones();
  }, [projectId]);

  const updateStatus = async (
    milestoneId: string,
    status: 'planned' | 'in_progress' | 'done'
  ) => {
    try {
      await updateMilestoneStatus(milestoneId, status);
      await loadMilestones(); // Refresh list
    } catch (err: any) {
      console.error('Failed to update milestone:', err);
      throw err;
    }
  };

  return { milestones, loading, error, refresh: loadMilestones, updateStatus };
}
