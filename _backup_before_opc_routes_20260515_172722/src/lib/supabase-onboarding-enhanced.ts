import { supabase } from './supabase';

// ==========================================
// ENHANCED ONBOARDING TYPES
// ==========================================

export interface EnhancedOnboardingParams {
  // Client Info
  companyName: string;
  clientName: string;
  email: string;
  phone?: string;
  contactPerson?: string;
  status: 'active' | 'inactive' | 'suspended' | 'test';
  language?: string;
  timezone?: string;
  preferredContactMethod?: string;

  // Tags
  tags: string[];
  customTags: string[];

  // SEO & Business
  domain?: string;
  website?: string;
  gmbProfileUrl?: string;
  instagram?: string;
  linkedin?: string;

  // Branding
  logoFile?: File;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  darkModeDefault: boolean;

  // Client Settings
  notifyOnMilestones: boolean;
  notifyOnNewFiles: boolean;
  notifyOnNotes: boolean;
  allowClientBrandCustomization: boolean;

  // Project Info
  projectTitle: string;
  projectDescription?: string;
  projectCategory?: string;
  projectManagerId: string;
  startDate?: string;
  deadline?: string;

  // Team Members
  teamMemberIds: string[];

  // Milestones
  milestoneMode: 'manual' | 'ai_assisted';
  autoGenerateTimeline: boolean;
  manualMilestones: Array<{
    title: string;
    description: string;
    deadline: string;
    assignedTo?: string;
  }>;

  // Checklist
  checklist: Array<{
    label: string;
    checked: boolean;
  }>;

  // Notes
  internalNotes?: string;
  clientVisibleNotes?: string;

  // Files
  initialFiles: Array<{
    file: File;
    fileType: 'contract' | 'email_log' | 'reference' | 'briefing' | 'legal' | 'asset' | 'miscellaneous';
    description?: string;
  }>;
}

export interface OnboardingResult {
  success: boolean;
  client: any;
  project: any;
  authUserId: string;
  temporaryPassword: string;
  loginUrl: string;
  error?: string;
}

// ==========================================
// HELPER FUNCTIONS
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

export const getDefaultMilestones = () => [
  { title: 'Project Kickoff', description: 'Initial meeting and project requirements gathering', days: 0 },
  { title: 'Discovery Phase', description: 'Research, analysis, and strategy development', days: 7 },
  { title: 'Design Phase', description: 'Create design concepts and mockups', days: 21 },
  { title: 'Revision Phase', description: 'Client feedback and design iterations', days: 35 },
  { title: 'Final Delivery', description: 'Project completion and handover', days: 49 },
];

// ==========================================
// ENSURE ADMIN PROFILE EXISTS
// ==========================================

export const ensureAdminProfileExists = async (): Promise<string | null> => {
  try {
    console.log('🔐 Ensuring admin profile exists...');
    
    // Get the currently authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Failed to get authenticated user:', userError);
      return null;
    }
    
    const currentUserId = user.id;
    const userEmail = user.email || 'Admin User';
    
    console.log('✅ Authenticated user ID:', currentUserId);
    
    // Upsert the admin profile (creates if not exists, ignores if exists)
    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        id: currentUserId,
        role: 'admin',
        name: userEmail,
      }, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });
    
    if (upsertError) {
      console.warn('Admin profile upsert warning (may be safe):', upsertError);
    } else {
      console.log('✅ Admin profile ensured in user_profiles');
    }
    
    return currentUserId;
  } catch (error) {
    console.error('Error ensuring admin profile:', error);
    return null;
  }
};

// ==========================================
// STAFF MEMBERS
// ==========================================

export const getStaffMembers = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, name')
    .in('role', ['admin', 'owner', 'freelancer'])
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching staff members:', error);
    return [];
  }

  return data || [];
};

// ==========================================
// FILE UPLOAD TO SUPABASE STORAGE
// ==========================================

export const uploadFile = async (file: File, clientId: string, projectId: string): Promise<string> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${clientId}/${projectId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('project-files')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
};

// ==========================================
// MAIN ENHANCED ONBOARDING FLOW
// ==========================================

export const executeEnhancedOnboarding = async (
  params: EnhancedOnboardingParams,
  baseUrl: string
): Promise<OnboardingResult> => {
  try {
    console.log('🚀 Starting enhanced onboarding...');

    // STEP 0: Ensure admin profile exists BEFORE any database writes
    console.log('📝 Step 0: Ensuring admin profile exists...');
    const adminUserId = await ensureAdminProfileExists();
    
    if (!adminUserId) {
      throw new Error('Failed to ensure admin profile exists. Cannot proceed with onboarding.');
    }
    
    console.log('✅ Admin profile verified, continuing with onboarding as:', adminUserId);

    // Generate temporary password for new client
    const temporaryPassword = generateSecurePassword(16);

    // A) Create Supabase Auth User for the NEW CLIENT
    console.log('📝 Step A: Creating auth user for new client...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.email,
      password: temporaryPassword,
    });

    if (authError || !authData.user) {
      throw new Error(`Auth creation failed: ${authError?.message}`);
    }

    const authUserId = authData.user.id;
    console.log('✅ Auth user created for client:', authUserId);

    // B) Insert user_profiles for NEW CLIENT
    console.log('📝 Step B: Inserting user profile for new client...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authUserId,
        role: 'client',
        name: params.clientName,
      });

    if (profileError) {
      throw new Error(`User profile creation failed: ${profileError.message}`);
    }
    console.log('✅ User profile created for client');

    // C) Insert into public.clients
    console.log('📝 Step C: Creating client record...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        user_id: authUserId,
        company_name: params.companyName,
        contact_person: params.contactPerson || params.clientName,
        email: params.email,
        phone: params.phone,
        status: params.status,
        language: params.language || 'en',
        timezone: params.timezone || 'UTC',
        preferred_contact_method: params.preferredContactMethod || 'email',
        last_activity_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (clientError || !client) {
      throw new Error(`Client creation failed: ${clientError?.message}`);
    }
    console.log('✅ Client created:', client.id);

    // D) Insert branding info
    console.log('📝 Step D: Inserting branding...');
    let logoUrl = params.logoUrl;
    if (params.logoFile) {
      try {
        logoUrl = await uploadFile(params.logoFile, client.id, 'branding');
      } catch (e) {
        console.warn('Logo upload failed, continuing without logo');
      }
    }

    const { error: brandingError } = await supabase
      .from('client_branding')
      .insert({
        client_id: client.id,
        logo_url: logoUrl,
        primary_color: params.primaryColor,
        secondary_color: params.secondaryColor,
        accent_color: params.accentColor,
        dark_mode_default: params.darkModeDefault,
      });

    if (brandingError) {
      console.warn('Branding insert failed:', brandingError);
    } else {
      console.log('✅ Branding created');
    }

    // E) Insert client settings
    console.log('📝 Step E: Inserting client settings...');
    const { error: settingsError } = await supabase
      .from('client_settings')
      .insert({
        client_id: client.id,
        domain: params.domain,
        website: params.website,
        gmb_profile_url: params.gmbProfileUrl,
        instagram: params.instagram,
        linkedin: params.linkedin,
        notify_on_milestones: params.notifyOnMilestones,
        notify_on_new_files: params.notifyOnNewFiles,
        notify_on_notes: params.notifyOnNotes,
        allow_client_brand_customization: params.allowClientBrandCustomization,
      });

    if (settingsError) {
      console.warn('Settings insert failed:', settingsError);
    } else {
      console.log('✅ Client settings created');
    }

    // F) Insert tags
    console.log('📝 Step F: Inserting tags...');
    const allTags = [...params.tags, ...params.customTags].filter(Boolean);
    if (allTags.length > 0) {
      const tagInserts = allTags.map(tag => ({
        client_id: client.id,
        tag_value: tag,
      }));

      const { error: tagsError } = await supabase
        .from('client_tags')
        .insert(tagInserts);

      if (tagsError) {
        console.warn('Tags insert failed:', tagsError);
      } else {
        console.log(`✅ ${allTags.length} tags created`);
      }
    }

    // G) Insert new project
    console.log('📝 Step G: Creating project...');
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        client_id: client.id,
        title: params.projectTitle,
        description: params.projectDescription,
        category: params.projectCategory || 'Website',
        status: 'planning',
        project_manager_id: params.projectManagerId || null,
        start_date: params.startDate,
        deadline: params.deadline,
      })
      .select()
      .single();

    if (projectError || !project) {
      throw new Error(`Project creation failed: ${projectError?.message}`);
    }
    console.log('✅ Project created:', project.id);

    // H) Insert team members
    console.log('📝 Step H: Adding team members...');
    const teamMemberIds = [params.projectManagerId, ...params.teamMemberIds].filter(Boolean);
    const uniqueTeamMemberIds = [...new Set(teamMemberIds)];

    if (uniqueTeamMemberIds.length > 0) {
      const teamInserts = uniqueTeamMemberIds.map(userId => ({
        project_id: project.id,
        user_id: userId,
      }));

      const { error: teamError } = await supabase
        .from('project_team_members')
        .insert(teamInserts);

      if (teamError) {
        console.warn('Team members insert failed:', teamError);
      } else {
        console.log(`✅ ${uniqueTeamMemberIds.length} team members added`);
      }
    }

    // I) Insert milestones
    console.log('📝 Step I: Inserting milestones...');
    let milestonesToInsert: any[] = [];

    if (params.milestoneMode === 'ai_assisted' && params.autoGenerateTimeline) {
      // Use default milestones
      const defaultMilestones = getDefaultMilestones();
      const startDate = params.startDate ? new Date(params.startDate) : new Date();

      milestonesToInsert = defaultMilestones.map((m, idx) => {
        const milestoneDate = new Date(startDate);
        milestoneDate.setDate(milestoneDate.getDate() + m.days);

        return {
          project_id: project.id,
          title: m.title,
          description: m.description,
          deadline: milestoneDate.toISOString().split('T')[0],
          status: 'not_started',
          order_index: idx,
        };
      });
    } else if (params.milestoneMode === 'manual' && params.manualMilestones.length > 0) {
      // Use manually entered milestones
      milestonesToInsert = params.manualMilestones.map((m, idx) => ({
        project_id: project.id,
        title: m.title,
        description: m.description,
        deadline: m.deadline,
        assigned_to: m.assignedTo,
        status: 'not_started',
        order_index: idx,
      }));
    }

    if (milestonesToInsert.length > 0) {
      const { error: milestonesError } = await supabase
        .from('project_milestones')
        .insert(milestonesToInsert);

      if (milestonesError) {
        console.warn('Milestones insert failed:', milestonesError);
      } else {
        console.log(`✅ ${milestonesToInsert.length} milestones created`);
      }
    }

    // J) Insert checklist items
    console.log('📝 Step J: Inserting checklist...');
    const checklistItems = params.checklist.filter(item => item.checked);
    if (checklistItems.length > 0) {
      const checklistInserts = checklistItems.map(item => ({
        project_id: project.id,
        item_label: item.label,
        is_required: true,
        is_completed: false,
      }));

      const { error: checklistError } = await supabase
        .from('project_checklists')
        .insert(checklistInserts);

      if (checklistError) {
        console.warn('Checklist insert failed:', checklistError);
      } else {
        console.log(`✅ ${checklistItems.length} checklist items created`);
      }
    }

    // K) Insert files (using admin's auth session)
    console.log('📝 Step K: Uploading initial files...');
    let uploadedFilesCount = 0;
    for (const fileItem of params.initialFiles) {
      try {
        const fileUrl = await uploadFile(fileItem.file, client.id, project.id);

        const { error: fileError } = await supabase
          .from('files')
          .insert({
            file_name: fileItem.file.name,
            file_url: fileUrl,
            file_type: fileItem.fileType,
            file_size: fileItem.file.size,
            client_id: client.id,
            project_id: project.id,
            uploaded_by: adminUserId, // Use admin's ID for uploaded_by
          });

        if (!fileError) {
          uploadedFilesCount++;
        }
      } catch (error) {
        console.warn(`Failed to upload file ${fileItem.file.name}:`, error);
      }
    }
    console.log(`✅ ${uploadedFilesCount} files uploaded`);

    // L) Insert notes (using admin's auth session)
    console.log('📝 Step L: Inserting notes...');
    const notesToInsert = [];

    if (params.internalNotes) {
      notesToInsert.push({
        project_id: project.id,
        note_type: 'internal',
        content: params.internalNotes,
        created_by: adminUserId, // Use admin's ID for created_by
      });
    }

    if (params.clientVisibleNotes) {
      notesToInsert.push({
        project_id: project.id,
        note_type: 'client_visible',
        content: params.clientVisibleNotes,
        created_by: adminUserId, // Use admin's ID for created_by
      });
    }

    if (notesToInsert.length > 0) {
      const { error: notesError } = await supabase
        .from('project_notes')
        .insert(notesToInsert);

      if (notesError) {
        console.warn('Notes insert failed:', notesError);
      } else {
        console.log(`✅ ${notesToInsert.length} notes created`);
      }
    }

    console.log('✅ Enhanced onboarding complete!');

    return {
      success: true,
      client,
      project,
      authUserId,
      temporaryPassword,
      loginUrl: baseUrl || '/',
    };
  } catch (error: any) {
    console.error('❌ Onboarding failed:', error);
    return {
      success: false,
      client: null,
      project: null,
      authUserId: '',
      temporaryPassword: '',
      loginUrl: '',
      error: error.message || 'Unknown error',
    };
  }
};
