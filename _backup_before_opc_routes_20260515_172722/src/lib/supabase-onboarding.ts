import { supabase } from './supabase';

// ==========================================
// TYPES FOR ONBOARDING
// ==========================================

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'owner' | 'freelancer' | 'client';
}

export interface ClientBranding {
  id?: string;
  client_id: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  dark_mode_default: boolean;
}

export interface ClientSettings {
  id?: string;
  client_id: string;
  allow_branding_customization: boolean;
  notify_on_milestones: boolean;
  notify_on_new_files: boolean;
  notify_on_notes: boolean;
  language: string;
  timezone: string;
  preferred_contact_method: string;
  tags: string[];
}

export interface ProjectMilestone {
  id?: string;
  project_id: string;
  title: string;
  description?: string;
  deadline?: string;
  assigned_to?: string;
  status: 'not_started' | 'active' | 'pending' | 'completed';
  order_index: number;
}

export interface ProjectNote {
  id?: string;
  project_id: string;
  note_type: 'internal' | 'client_visible';
  content: string;
  created_by?: string;
}

export interface ProjectChecklist {
  id?: string;
  project_id: string;
  item_label: string;
  is_required: boolean;
  is_completed: boolean;
}

export interface ProjectTeamMember {
  id?: string;
  project_id: string;
  user_id: string;
  role?: string;
}

export interface ProjectFile {
  id?: string;
  client_id: string;
  project_id: string;
  file_url: string;
  file_name: string;
  description?: string;
  uploaded_by: string;
}

// ==========================================
// USER PROFILES
// ==========================================

export const getUserProfiles = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .in('role', ['admin', 'owner', 'freelancer'])
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error fetching user profiles:', error);
    return [];
  }

  return data || [];
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
};

// ==========================================
// AUTH FUNCTIONS
// ==========================================

export const createAuthUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('Error creating auth user:', error);
    throw error;
  }

  return data;
};

// ==========================================
// CLIENT BRANDING
// ==========================================

export const insertClientBranding = async (branding: Omit<ClientBranding, 'id'>): Promise<ClientBranding | null> => {
  const { data, error } = await supabase
    .from('client_branding')
    .insert(branding)
    .select()
    .single();

  if (error) {
    console.error('Error inserting client branding:', error);
    return null;
  }

  return data;
};

export const getClientBranding = async (clientId: string): Promise<ClientBranding | null> => {
  const { data, error } = await supabase
    .from('client_branding')
    .select('*')
    .eq('client_id', clientId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching client branding:', error);
    return null;
  }

  return data;
};

// ==========================================
// CLIENT SETTINGS
// ==========================================

export const insertClientSettings = async (settings: Omit<ClientSettings, 'id'>): Promise<ClientSettings | null> => {
  const { data, error } = await supabase
    .from('client_settings')
    .insert(settings)
    .select()
    .single();

  if (error) {
    console.error('Error inserting client settings:', error);
    return null;
  }

  return data;
};

export const getClientSettings = async (clientId: string): Promise<ClientSettings | null> => {
  const { data, error } = await supabase
    .from('client_settings')
    .select('*')
    .eq('client_id', clientId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching client settings:', error);
    return null;
  }

  return data;
};

// ==========================================
// PROJECT MILESTONES
// ==========================================

export const insertProjectMilestone = async (milestone: Omit<ProjectMilestone, 'id'>): Promise<ProjectMilestone | null> => {
  const { data, error } = await supabase
    .from('project_milestones')
    .insert(milestone)
    .select()
    .single();

  if (error) {
    console.error('Error inserting project milestone:', error);
    return null;
  }

  return data;
};

export const insertProjectMilestones = async (milestones: Omit<ProjectMilestone, 'id'>[]): Promise<ProjectMilestone[]> => {
  if (milestones.length === 0) return [];

  const { data, error } = await supabase
    .from('project_milestones')
    .insert(milestones)
    .select();

  if (error) {
    console.error('Error inserting project milestones:', error);
    return [];
  }

  return data || [];
};

export const getProjectMilestones = async (projectId: string): Promise<ProjectMilestone[]> => {
  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching project milestones:', error);
    return [];
  }

  return data || [];
};

// ==========================================
// PROJECT NOTES
// ==========================================

export const insertProjectNote = async (note: Omit<ProjectNote, 'id'>): Promise<ProjectNote | null> => {
  const { data, error } = await supabase
    .from('project_notes')
    .insert(note)
    .select()
    .single();

  if (error) {
    console.error('Error inserting project note:', error);
    return null;
  }

  return data;
};

export const getProjectNotes = async (projectId: string, noteType?: 'internal' | 'client_visible'): Promise<ProjectNote[]> => {
  let query = supabase
    .from('project_notes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (noteType) {
    query = query.eq('note_type', noteType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching project notes:', error);
    return [];
  }

  return data || [];
};

// ==========================================
// PROJECT CHECKLISTS
// ==========================================

export const insertProjectChecklist = async (checklist: Omit<ProjectChecklist, 'id'>): Promise<ProjectChecklist | null> => {
  const { data, error } = await supabase
    .from('project_checklists')
    .insert(checklist)
    .select()
    .single();

  if (error) {
    console.error('Error inserting project checklist:', error);
    return null;
  }

  return data;
};

export const insertProjectChecklists = async (checklists: Omit<ProjectChecklist, 'id'>[]): Promise<ProjectChecklist[]> => {
  if (checklists.length === 0) return [];

  const { data, error } = await supabase
    .from('project_checklists')
    .insert(checklists)
    .select();

  if (error) {
    console.error('Error inserting project checklists:', error);
    return [];
  }

  return data || [];
};

export const getProjectChecklists = async (projectId: string): Promise<ProjectChecklist[]> => {
  const { data, error } = await supabase
    .from('project_checklists')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching project checklists:', error);
    return [];
  }

  return data || [];
};

// ==========================================
// PROJECT TEAM MEMBERS
// ==========================================

export const insertProjectTeamMember = async (teamMember: Omit<ProjectTeamMember, 'id'>): Promise<ProjectTeamMember | null> => {
  const { data, error } = await supabase
    .from('project_team_members')
    .insert(teamMember)
    .select()
    .single();

  if (error) {
    console.error('Error inserting project team member:', error);
    return null;
  }

  return data;
};

export const insertProjectTeamMembers = async (teamMembers: Omit<ProjectTeamMember, 'id'>[]): Promise<ProjectTeamMember[]> => {
  if (teamMembers.length === 0) return [];

  const { data, error } = await supabase
    .from('project_team_members')
    .insert(teamMembers)
    .select();

  if (error) {
    console.error('Error inserting project team members:', error);
    return [];
  }

  return data || [];
};

export const getProjectTeamMembers = async (projectId: string): Promise<ProjectTeamMember[]> => {
  const { data, error } = await supabase
    .from('project_team_members')
    .select('*')
    .eq('project_id', projectId);

  if (error) {
    console.error('Error fetching project team members:', error);
    return [];
  }

  return data || [];
};

// ==========================================
// FILE UPLOAD
// ==========================================

export const uploadProjectFile = async (file: File, clientId: string, projectId: string, userId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${clientId}/${projectId}/${Date.now()}.${fileExt}`;
  const filePath = `project-files/${fileName}`;

  const { error } = await supabase.storage
    .from('project-uploads')
    .upload(filePath, file);

  if (error) {
    console.error('Error uploading file:', error);
    throw error;
  }

  const { data } = supabase.storage
    .from('project-uploads')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

export const insertProjectFile = async (fileData: Omit<ProjectFile, 'id'>): Promise<ProjectFile | null> => {
  const { data, error } = await supabase
    .from('files')
    .insert(fileData)
    .select()
    .single();

  if (error) {
    console.error('Error inserting project file:', error);
    return null;
  }

  return data;
};

export const getProjectFiles = async (projectId: string): Promise<ProjectFile[]> => {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('Error fetching project files:', error);
    return [];
  }

  return data || [];
};

// ==========================================
// HELPER: GENERATE SECURE PASSWORD
// ==========================================

export const generateSecurePassword = (length: number = 12): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  return password;
};

// ==========================================
// HELPER: CREATE DEFAULT MILESTONES
// ==========================================

export const createDefaultMilestones = (projectId: string): Omit<ProjectMilestone, 'id'>[] => {
  const defaultMilestones = [
    { title: 'Project Kickoff', description: 'Initial meeting and project setup', order_index: 0 },
    { title: 'Research / Discovery', description: 'Market research and requirements gathering', order_index: 1 },
    { title: 'Design Phase', description: 'Design concepts and mockups', order_index: 2 },
    { title: 'Revision Phase', description: 'Client feedback and revisions', order_index: 3 },
    { title: 'Final Delivery', description: 'Project completion and handover', order_index: 4 },
  ];

  return defaultMilestones.map(m => ({
    project_id: projectId,
    title: m.title,
    description: m.description,
    status: 'not_started' as const,
    order_index: m.order_index,
  }));
};

// ==========================================
// MAIN ONBOARDING FLOW
// ==========================================

interface OnboardingParams {
  companyName: string;
  clientName: string;
  contactPerson?: string;
  email: string;
  password: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended' | 'test';
  tags?: string[];
  projectTitle: string;
  projectDescription?: string;
  projectCategory?: string;
  projectManagerId: string;
  internalNotes?: string;
  checklist?: string[];
  milestones?: Array<{
    title: string;
    description: string;
    due_date: string;
  }>;
  baseUrl: string;
}

export const createClientOnboarding = async (params: OnboardingParams) => {
  try {
    const {
      companyName,
      clientName,
      contactPerson,
      email,
      password,
      phone,
      status,
      tags = [],
      projectTitle,
      projectDescription,
      projectCategory,
      projectManagerId,
      internalNotes,
      checklist = [],
      milestones = [],
      baseUrl
    } = params;

    // Step 1: Create auth user
    console.log('Creating auth user...');
    const authResult = await createAuthUser(email, password);
    if (!authResult.success || !authResult.user) {
      throw new Error(authResult.error || 'Failed to create auth user');
    }
    const authUserId = authResult.user.id;

    // Step 2: Update profile to be a client
    console.log('Updating user profile...');
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: clientName,
        role: 'client'
      })
      .eq('id', authResult.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw new Error('Failed to update user profile');
    }

    // Step 3: Create client record
    console.log('Creating client record...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: clientName,
        company_name: companyName,
        email: email,
        contact_person: contactPerson,
        phone: phone,
        status: status,
        tags: tags,
        user_id: authResult.user.id
      })
      .select()
      .single();

    if (clientError || !client) {
      console.error('Client creation error:', clientError);
      throw new Error('Failed to create client record');
    }

    // Step 4: Create project
    console.log('Creating project...');
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        client_id: client.id,
        title: projectTitle,
        description: projectDescription || '',
        category: projectCategory || 'Website',
        status: 'planning',
        project_manager_id: projectManagerId
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error('Project creation error:', projectError);
      throw new Error('Failed to create project');
    }

    // Step 5: Add milestones
    if (milestones.length > 0) {
      console.log('Adding milestones...');
      const milestoneData = milestones.map(m => ({
        project_id: project.id,
        title: m.title,
        description: m.description,
        due_date: m.due_date,
        status: 'upcoming' as const
      }));
      await insertProjectMilestones(milestoneData);
    }

    // Step 6: Add checklist items
    if (checklist.length > 0) {
      console.log('Adding checklist...');
      const checklistData = checklist.map((item) => ({
        project_id: project.id,
        item_text: item,
        is_completed: false,
        required: false
      }));
      await insertProjectChecklists(checklistData);
    }

    // Step 7: Add internal notes if provided
    if (internalNotes) {
      console.log('Adding internal notes...');
      await insertProjectNote({
        project_id: project.id,
        note_text: internalNotes,
        note_type: 'internal',
        created_by: projectManagerId
      });
    }

    // Step 8: Add project manager as team member
    console.log('Adding project manager to team...');
    await insertProjectTeamMember({
      project_id: project.id,
      user_id: projectManagerId,
      role: 'project_manager'
    });

    console.log('Onboarding complete!');
    return {
      success: true,
      client,
      project
    };

  } catch (error: any) {
    console.error('Onboarding error:', error);
    throw error;
  }
};
