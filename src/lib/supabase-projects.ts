





/**
 * Supabase Project Management Helper Functions
 * Handles all project-related data operations with RPC functions
 */

import { supabase } from './supabase';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface Project {
  id: string;
  client_id: string;
  project_title: string;
  category: string;
  status: 'active' | 'on_hold' | 'completed';
  progress_percent: number;
  start_date: string;
  deadline: string;
  assigned_to?: string;
  description: string;
  last_update_at: string;
  created_at: string;
  // Joined data
  client?: {
    id: string;
    company_name: string;
    client_name: string;
    email: string;
  };
}

export interface ProjectFile {
  id: string;
  project_id: string;
  filename: string;              // ✅ Correct column name
  type: 'file' | 'folder';      // ✅ File or folder
  storage_path: string | null;
  parent_id: string | null;     // ✅ For hierarchy
  bucket: string;               // ✅ Storage bucket
  size: number | null;          // ✅ File size in bytes
  file_type: string | null;     // ✅ MIME type
  uploaded_by: string;          // ✅ User who uploaded
  visibility: string;           // ✅ Access control
  soft_deleted?: boolean;       // ✅ Optional - may not exist in all schemas
  created_at: string;
  updated_at: string;
  uploaded_at: string;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  sender_id: string;
  kind: 'message' | 'system';
  subject?: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  // Joined data
  sender?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface ProjectInvoice {
  id: string;
  project_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'overdue';
  issued_at: string;
  due_at: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectPayment {
  id: string;
  project_id: string;
  invoice_id?: string;
  amount: number;
  payment_date: string;
  method: string;
  created_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  due_date: string;
  status: 'planned' | 'in_progress' | 'done';
  order_index: number;
  staff_notes?: string;
  client_notes?: string;
  updated_at: string;
  created_at: string;
}

// ==========================================
// PROJECT QUERIES
// ==========================================

/**
 * List all projects (Admin/Owner view)
 * Uses RPC function with RLS
 */
export async function listProjects() {
  const { data, error } = await supabase.rpc('list_projects');
  
  if (error) {
    console.error('Error listing projects:', error);
    throw error;
  }
  
  return data as Project[];
}

/**
 * List projects for a specific client (Client view)
 */
export async function listClientProjects(clientId: string) {
  const { data, error } = await supabase.rpc('list_client_projects', {
    p_client_id: clientId
  });
  
  if (error) {
    console.error('Error listing client projects:', error);
    throw error;
  }
  
  return data as Project[];
}

/**
 * Get single project by ID with client info
 */
export async function getProject(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      client:clients (
        id,
        company_name,
        client_name,
        email
      )
    `)
    .eq('id', projectId)
    .single();
  
  if (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
  
  return data as Project;
}

/**
 * Update project details
 */
export async function updateProject(projectId: string, updates: Partial<Project>) {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      last_update_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating project:', error);
    throw error;
  }
  
  return data as Project;
}

// ==========================================
// PROJECT PROGRESS CALCULATION
// ==========================================

/**
 * Calculate project progress based on milestone completion
 * Progress = (completed milestones / total milestones) * 100
 */
export async function calculateProjectProgress(projectId: string): Promise<number> {
  try {
    const milestones = await getProjectMilestones(projectId);
    
    // If no milestones, progress is 0%
    if (!milestones || milestones.length === 0) {
      return 0;
    }
    
    // Count completed milestones
    const completedCount = milestones.filter(m => m.status === 'done').length;
    const totalCount = milestones.length;
    
    // Calculate percentage
    const progress = Math.round((completedCount / totalCount) * 100);
    
    return progress;
  } catch (error) {
    console.error('Error calculating project progress:', error);
    return 0;
  }
}

/**
 * Automatically update project progress based on milestones
 * Call this after creating, updating, or deleting milestones
 */
export async function updateProjectProgress(projectId: string) {
  try {
    const progress = await calculateProjectProgress(projectId);
    
    await supabase
      .from('projects')
      .update({
        progress_percent: progress,
        last_update_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    return progress;
  } catch (error) {
    console.error('Error updating project progress:', error);
    throw error;
  }
}

// ==========================================
// PROJECT FILES
// ==========================================

/**
 * List files for a project
 */
export async function listProjectFiles(projectId: string) {
  console.log('📂 Fetching files for project:', projectId);
  
  // ✅ FIXED: Query table directly without soft_deleted filter
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    // ✅ Removed soft_deleted filter - column doesn't exist in schema
    .order('type', { ascending: true })  // Folders first
    .order('filename', { ascending: true });
  
  if (error) {
    console.error('❌ Error listing project files:', error);
    throw error;
  }
  
  console.log('✅ Found files:', data?.length || 0);
  console.log('📋 Files data:', data);
  
  return data as ProjectFile[];
}

/**
 * Upload new file to project
 */
export async function uploadProjectFile(
  projectId: string,
  filename: string,
  parentId?: string
) {
  const { data, error } = await supabase.rpc('upload_project_file', {
    p_project_id: projectId,
    p_filename: filename,
    p_parent_id: parentId || null
  });
  
  if (error) {
    console.error('Error uploading project file:', error);
    throw error;
  }
  
  return data;
}

/**
 * Link existing client file to project
 */
export async function projectLinkFile(projectId: string, clientFileId: string) {
  const { data, error } = await supabase.rpc('project_link_file', {
    p_project_id: projectId,
    p_client_file_id: clientFileId
  });
  
  if (error) {
    console.error('Error linking file to project:', error);
    throw error;
  }
  
  return data;
}

// ==========================================
// PROJECT MESSAGES / CHAT
// ==========================================

/**
 * Get project chat/message history
 */
export async function getProjectChat(projectId: string) {
  const { data, error } = await supabase.rpc('get_project_chat', {
    p_project_id: projectId
  });
  
  if (error) {
    console.error('Error fetching project chat:', error);
    throw error;
  }
  
  return data as ProjectMessage[];
}

/**
 * Send message to project
 */
export async function sendProjectMessage(
  projectId: string,
  message: string,
  isInternal: boolean = false
) {
  const { data, error } = await supabase.rpc('send_project_message', {
    p_project_id: projectId,
    p_message: message,
    p_is_internal: isInternal
  });
  
  if (error) {
    console.error('Error sending project message:', error);
    throw error;
  }
  
  return data;
}

// ==========================================
// PROJECT INVOICES & PAYMENTS
// ==========================================

/**
 * Get invoices for a project
 */
export async function getProjectInvoices(projectId: string) {
  const { data, error } = await supabase
    .from('project_invoices')
    .select('*')
    .eq('project_id', projectId)
    .order('issued_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching project invoices:', error);
    throw error;
  }
  
  return data as ProjectInvoice[];
}

/**
 * Get payments for a project
 */
export async function getProjectPayments(projectId: string) {
  const { data, error } = await supabase
    .from('project_payments')
    .select('*')
    .eq('project_id', projectId)
    .order('payment_date', { ascending: false });
  
  if (error) {
    console.error('Error fetching project payments:', error);
    throw error;
  }
  
  return data as ProjectPayment[];
}

// ==========================================
// PROJECT MILESTONES
// ==========================================

/**
 * Get milestones for a project
 */
export async function getProjectMilestones(projectId: string) {
  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true });
  
  if (error) {
    console.error('Error fetching project milestones:', error);
    throw error;
  }
  
  return data as ProjectMilestone[];
}

/**
 * Create a new milestone and update project progress
 */
export async function createMilestone(
  projectId: string,
  milestone: Omit<ProjectMilestone, 'id' | 'created_at' | 'updated_at' | 'order_index'>
) {
  // Get current milestones to determine order_index
  const existingMilestones = await getProjectMilestones(projectId);
  const orderIndex = existingMilestones.length;
  
  const { data, error } = await supabase
    .from('project_milestones')
    .insert({
      ...milestone,
      project_id: projectId,
      order_index: orderIndex
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating milestone:', error);
    throw error;
  }
  
  // Automatically update project progress
  await updateProjectProgress(projectId);
  
  return data as ProjectMilestone;
}

/**
 * Update milestone status and recalculate project progress
 */
export async function updateMilestoneStatus(
  milestoneId: string,
  status: 'planned' | 'in_progress' | 'done'
) {
  // First get the milestone to find the project_id
  const { data: milestone, error: fetchError } = await supabase
    .from('project_milestones')
    .select('project_id')
    .eq('id', milestoneId)
    .single();
  
  if (fetchError) {
    console.error('Error fetching milestone:', fetchError);
    throw fetchError;
  }
  
  // Update the milestone status
  const { data, error } = await supabase
    .from('project_milestones')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', milestoneId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating milestone:', error);
    throw error;
  }
  
  // Automatically update project progress
  await updateProjectProgress(milestone.project_id);
  
  return data as ProjectMilestone;
}

/**
 * Update milestone notes (staff and/or client notes)
 */
export async function updateMilestoneNotes(
  milestoneId: string,
  updates: {
    staff_notes?: string;
    client_notes?: string;
  }
) {
  const { data, error } = await supabase
    .from('project_milestones')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', milestoneId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating milestone notes:', error);
    throw error;
  }
  
  return data as ProjectMilestone;
}

/**
 * Delete a milestone and recalculate project progress
 */
export async function deleteMilestone(milestoneId: string) {
  // First get the milestone to find the project_id
  const { data: milestone, error: fetchError } = await supabase
    .from('project_milestones')
    .select('project_id')
    .eq('id', milestoneId)
    .single();
  
  if (fetchError) {
    console.error('Error fetching milestone:', fetchError);
    throw fetchError;
  }
  
  const projectId = milestone.project_id;
  
  // Delete the milestone
  const { error } = await supabase
    .from('project_milestones')
    .delete()
    .eq('id', milestoneId);
  
  if (error) {
    console.error('Error deleting milestone:', error);
    throw error;
  }
  
  // Automatically update project progress
  await updateProjectProgress(projectId);
  
  return true;
}

// ==========================================
// HELPER: Get Client ID for Current User
// ==========================================

/**
 * Get client_id for the current authenticated user
 * (for client role only)
 */
export async function getCurrentClientId() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (error) {
    console.error('Error fetching client ID:', error);
    throw error;
  }
  
  return data.id;
}






