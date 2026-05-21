// Translation system for Miraka & Co Portal
// Supports: German (de), English (en), French (fr), Spanish (es)

export type Language = 'de' | 'en' | 'fr' | 'es';

export interface Translations {
  // Common
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    view: string;
    search: string;
    filter: string;
    loading: string;
    error: string;
    success: string;
    back: string;
    next: string;
    previous: string;
    close: string;
    open: string;
    yes: string;
    no: string;
    all: string;
    none: string;
    select: string;
    upload: string;
    download: string;
    export: string;
    import: string;
    refresh: string;
    settings: string;
    logout: string;
    profile: string;
    dashboard: string;
    new: string;
    create: string;
    update: string;
    confirm: string;
    actions: string;
  };

  // Authentication
  auth: {
    login: string;
    loginTitle: string;
    loginSubtitle: string;
    email: string;
    password: string;
    forgotPassword: string;
    resetPassword: string;
    setPassword: string;
    newPassword: string;
    confirmPassword: string;
    signIn: string;
    signOut: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    invalidCredentials: string;
    loginSuccess: string;
    logoutSuccess: string;
  };

  // Dashboard
  dashboard: {
    welcome: string;
    welcomeBack: string;
    overview: string;
    statistics: string;
    recentActivity: string;
    quickActions: string;
    viewAll: string;
  };

  // Sidebar Navigation
  nav: {
    dashboard: string;
    projects: string;
    clients: string;
    tickets: string;
    files: string;
    workOs: string;
    tools: string;
    settings: string;
    logout: string;
    businessScraper: string;
    invoice: string;
  };

  // Projects
  projects: {
    title: string;
    myProjects: string;
    allProjects: string;
    activeProjects: string;
    completedProjects: string;
    newProject: string;
    createProject: string;
    editProject: string;
    projectDetails: string;
    projectName: string;
    projectDescription: string;
    projectStatus: string;
    projectCategory: string;
    projectProgress: string;
    startDate: string;
    endDate: string;
    dueDate: string;
    client: string;
    selectClient: string;
    milestones: string;
    timeline: string;
    notes: string;
    projectCreated: string;
    projectUpdated: string;
    projectDeleted: string;
    noProjects: string;
    total: string;
    active: string;
    completed: string;
    onHold: string;
    cancelled: string;
  };

  // Clients
  clients: {
    title: string;
    allClients: string;
    activeClients: string;
    archivedClients: string;
    newClient: string;
    createClient: string;
    editClient: string;
    clientDetails: string;
    clientName: string;
    companyName: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    website: string;
    notes: string;
    clientCreated: string;
    clientUpdated: string;
    clientDeleted: string;
    clientArchived: string;
    clientRestored: string;
    noClients: string;
    totalClients: string;
    selectClient: string;
  };

  // Tickets
  tickets: {
    title: string;
    supportTickets: string;
    allTickets: string;
    myTickets: string;
    newTicket: string;
    createTicket: string;
    ticketDetails: string;
    ticketTitle: string;
    ticketDescription: string;
    ticketStatus: string;
    ticketPriority: string;
    assignedTo: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    ticketCreated: string;
    ticketUpdated: string;
    ticketClosed: string;
    noTickets: string;
    totalTickets: string;
    openTickets: string;
    inProgress: string;
    resolved: string;
    closed: string;
    priority: {
      low: string;
      medium: string;
      high: string;
      urgent: string;
    };
    status: {
      open: string;
      inProgress: string;
      resolved: string;
      closed: string;
    };
  };

  // Files
  files: {
    title: string;
    allFiles: string;
    myFiles: string;
    recentFiles: string;
    uploadFile: string;
    uploadFiles: string;
    downloadFile: string;
    deleteFile: string;
    fileName: string;
    fileSize: string;
    fileType: string;
    uploadedBy: string;
    uploadedAt: string;
    fileUploaded: string;
    fileDeleted: string;
    noFiles: string;
    dragAndDrop: string;
    selectFiles: string;
  };

  // Work OS
  workOs: {
    title: string;
    boards: string;
    myBoards: string;
    allBoards: string;
    newBoard: string;
    createBoard: string;
    boardName: string;
    boardDescription: string;
    items: string;
    newItem: string;
    createItem: string;
    itemName: string;
    tableView: string;
    kanbanView: string;
    workspace: string;
    workspaces: string;
  };

  // Settings
  settings: {
    title: string;
    accountSettings: string;
    profileSettings: string;
    notificationSettings: string;
    securitySettings: string;
    billingSettings: string;
    systemSettings: string;
    personalInfo: string;
    fullName: string;
    email: string;
    phone: string;
    avatar: string;
    uploadAvatar: string;
    changePassword: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    language: string;
    timezone: string;
    theme: string;
    lightMode: string;
    darkMode: string;
    notifications: string;
    emailNotifications: string;
    pushNotifications: string;
    settingsSaved: string;
    settingsError: string;
  };

  // Invoice
  invoice: {
    title: string;
    createInvoice: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    billTo: string;
    billFrom: string;
    items: string;
    addItem: string;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
    subtotal: string;
    tax: string;
    total: string;
    notes: string;
    termsAndConditions: string;
    previewInvoice: string;
    downloadInvoice: string;
    sendInvoice: string;
    invoiceCreated: string;
    invoiceSent: string;
  };

  // Business Scraper
  businessScraper: {
    title: string;
    searchBusinesses: string;
    searchQuery: string;
    location: string;
    radius: string;
    maxResults: string;
    search: string;
    searching: string;
    results: string;
    businessName: string;
    address: string;
    phone: string;
    website: string;
    rating: string;
    reviews: string;
    exportResults: string;
    exportPDF: string;
    exportCSV: string;
    noResults: string;
  };

  // Status Messages
  status: {
    loading: string;
    saving: string;
    saved: string;
    deleting: string;
    deleted: string;
    uploading: string;
    uploaded: string;
    downloading: string;
    downloaded: string;
    processing: string;
    processed: string;
    error: string;
    success: string;
    warning: string;
    info: string;
  };

  // Error Messages
  errors: {
    generic: string;
    notFound: string;
    unauthorized: string;
    forbidden: string;
    serverError: string;
    networkError: string;
    validationError: string;
    required: string;
    invalidEmail: string;
    invalidPhone: string;
    invalidUrl: string;
    minLength: string;
    maxLength: string;
  };

  // Date & Time
  dateTime: {
    today: string;
    yesterday: string;
    tomorrow: string;
    thisWeek: string;
    lastWeek: string;
    thisMonth: string;
    lastMonth: string;
    thisYear: string;
    lastYear: string;
    daysAgo: string;
    hoursAgo: string;
    minutesAgo: string;
    justNow: string;
  };
}

export const translations: Record<Language, Translations> = {
  de: {
    common: {
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      view: 'Ansehen',
      search: 'Suchen',
      filter: 'Filtern',
      loading: 'Lädt...',
      error: 'Fehler',
      success: 'Erfolgreich',
      back: 'Zurück',
      next: 'Weiter',
      previous: 'Zurück',
      close: 'Schließen',
      open: 'Öffnen',
      yes: 'Ja',
      no: 'Nein',
      all: 'Alle',
      none: 'Keine',
      select: 'Auswählen',
      upload: 'Hochladen',
      download: 'Herunterladen',
      export: 'Exportieren',
      import: 'Importieren',
      refresh: 'Aktualisieren',
      settings: 'Einstellungen',
      logout: 'Abmelden',
      profile: 'Profil',
      dashboard: 'Dashboard',
      new: 'Neu',
      create: 'Erstellen',
      update: 'Aktualisieren',
      confirm: 'Bestätigen',
      actions: 'Aktionen',
    },
    auth: {
      login: 'Anmelden',
      loginTitle: 'Willkommen zurück',
      loginSubtitle: 'Melden Sie sich bei Ihrem Konto an',
      email: 'E-Mail',
      password: 'Passwort',
      forgotPassword: 'Passwort vergessen?',
      resetPassword: 'Passwort zurücksetzen',
      setPassword: 'Passwort festlegen',
      newPassword: 'Neues Passwort',
      confirmPassword: 'Passwort bestätigen',
      signIn: 'Anmelden',
      signOut: 'Abmelden',
      emailPlaceholder: 'name@beispiel.de',
      passwordPlaceholder: 'Ihr Passwort',
      invalidCredentials: 'Ungültige Anmeldedaten',
      loginSuccess: 'Erfolgreich angemeldet',
      logoutSuccess: 'Erfolgreich abgemeldet',
    },
    dashboard: {
      welcome: 'Willkommen',
      welcomeBack: 'Willkommen zurück',
      overview: 'Übersicht',
      statistics: 'Statistiken',
      recentActivity: 'Letzte Aktivitäten',
      quickActions: 'Schnellaktionen',
      viewAll: 'Alle anzeigen',
    },
    nav: {
      dashboard: 'Dashboard',
      projects: 'Projekte',
      clients: 'Kunden',
      tickets: 'Tickets',
      files: 'Dateien',
      workOs: 'Work OS',
      tools: 'Werkzeuge',
      settings: 'Einstellungen',
      logout: 'Abmelden',
      businessScraper: 'Firmendaten',
      invoice: 'Rechnung',
    },
    projects: {
      title: 'Projekte',
      myProjects: 'Meine Projekte',
      allProjects: 'Alle Projekte',
      activeProjects: 'Aktive Projekte',
      completedProjects: 'Abgeschlossene Projekte',
      newProject: 'Neues Projekt',
      createProject: 'Projekt erstellen',
      editProject: 'Projekt bearbeiten',
      projectDetails: 'Projektdetails',
      projectName: 'Projektname',
      projectDescription: 'Projektbeschreibung',
      projectStatus: 'Projektstatus',
      projectCategory: 'Projektkategorie',
      projectProgress: 'Projektfortschritt',
      startDate: 'Startdatum',
      endDate: 'Enddatum',
      dueDate: 'Fälligkeitsdatum',
      client: 'Kunde',
      selectClient: 'Kunde auswählen',
      milestones: 'Meilensteine',
      timeline: 'Zeitplan',
      notes: 'Notizen',
      projectCreated: 'Projekt erfolgreich erstellt',
      projectUpdated: 'Projekt erfolgreich aktualisiert',
      projectDeleted: 'Projekt erfolgreich gelöscht',
      noProjects: 'Keine Projekte gefunden',
      total: 'Gesamt',
      active: 'Aktiv',
      completed: 'Abgeschlossen',
      onHold: 'Pausiert',
      cancelled: 'Abgebrochen',
    },
    clients: {
      title: 'Kunden',
      allClients: 'Alle Kunden',
      activeClients: 'Aktive Kunden',
      archivedClients: 'Archivierte Kunden',
      newClient: 'Neuer Kunde',
      createClient: 'Kunde erstellen',
      editClient: 'Kunde bearbeiten',
      clientDetails: 'Kundendetails',
      clientName: 'Kundenname',
      companyName: 'Firmenname',
      contactPerson: 'Ansprechpartner',
      email: 'E-Mail',
      phone: 'Telefon',
      address: 'Adresse',
      city: 'Stadt',
      postalCode: 'Postleitzahl',
      country: 'Land',
      website: 'Webseite',
      notes: 'Notizen',
      clientCreated: 'Kunde erfolgreich erstellt',
      clientUpdated: 'Kunde erfolgreich aktualisiert',
      clientDeleted: 'Kunde erfolgreich gelöscht',
      clientArchived: 'Kunde erfolgreich archiviert',
      clientRestored: 'Kunde erfolgreich wiederhergestellt',
      noClients: 'Keine Kunden gefunden',
      totalClients: 'Gesamtkunden',
      selectClient: 'Kunde auswählen',
    },
    tickets: {
      title: 'Tickets',
      supportTickets: 'Support-Tickets',
      allTickets: 'Alle Tickets',
      myTickets: 'Meine Tickets',
      newTicket: 'Neues Ticket',
      createTicket: 'Ticket erstellen',
      ticketDetails: 'Ticketdetails',
      ticketTitle: 'Tickettitel',
      ticketDescription: 'Ticketbeschreibung',
      ticketStatus: 'Ticketstatus',
      ticketPriority: 'Ticketpriorität',
      assignedTo: 'Zugewiesen an',
      createdBy: 'Erstellt von',
      createdAt: 'Erstellt am',
      updatedAt: 'Aktualisiert am',
      ticketCreated: 'Ticket erfolgreich erstellt',
      ticketUpdated: 'Ticket erfolgreich aktualisiert',
      ticketClosed: 'Ticket erfolgreich geschlossen',
      noTickets: 'Keine Tickets gefunden',
      totalTickets: 'Gesamt-Tickets',
      openTickets: 'Offene Tickets',
      inProgress: 'In Bearbeitung',
      resolved: 'Gelöst',
      closed: 'Geschlossen',
      priority: {
        low: 'Niedrig',
        medium: 'Mittel',
        high: 'Hoch',
        urgent: 'Dringend',
      },
      status: {
        open: 'Offen',
        inProgress: 'In Bearbeitung',
        resolved: 'Gelöst',
        closed: 'Geschlossen',
      },
    },
    files: {
      title: 'Dateien',
      allFiles: 'Alle Dateien',
      myFiles: 'Meine Dateien',
      recentFiles: 'Letzte Dateien',
      uploadFile: 'Datei hochladen',
      uploadFiles: 'Dateien hochladen',
      downloadFile: 'Datei herunterladen',
      deleteFile: 'Datei löschen',
      fileName: 'Dateiname',
      fileSize: 'Dateigröße',
      fileType: 'Dateityp',
      uploadedBy: 'Hochgeladen von',
      uploadedAt: 'Hochgeladen am',
      fileUploaded: 'Datei erfolgreich hochgeladen',
      fileDeleted: 'Datei erfolgreich gelöscht',
      noFiles: 'Keine Dateien gefunden',
      dragAndDrop: 'Dateien hier ablegen oder klicken zum Hochladen',
      selectFiles: 'Dateien auswählen',
    },
    workOs: {
      title: 'Work OS',
      boards: 'Boards',
      myBoards: 'Meine Boards',
      allBoards: 'Alle Boards',
      newBoard: 'Neues Board',
      createBoard: 'Board erstellen',
      boardName: 'Board-Name',
      boardDescription: 'Board-Beschreibung',
      items: 'Elemente',
      newItem: 'Neues Element',
      createItem: 'Element erstellen',
      itemName: 'Elementname',
      tableView: 'Tabellenansicht',
      kanbanView: 'Kanban-Ansicht',
      workspace: 'Arbeitsbereich',
      workspaces: 'Arbeitsbereiche',
    },
    settings: {
      title: 'Einstellungen',
      accountSettings: 'Kontoeinstellungen',
      profileSettings: 'Profileinstellungen',
      notificationSettings: 'Benachrichtigungseinstellungen',
      securitySettings: 'Sicherheitseinstellungen',
      billingSettings: 'Rechnungseinstellungen',
      systemSettings: 'Systemeinstellungen',
      personalInfo: 'Persönliche Informationen',
      fullName: 'Vollständiger Name',
      email: 'E-Mail',
      phone: 'Telefon',
      avatar: 'Profilbild',
      uploadAvatar: 'Profilbild hochladen',
      changePassword: 'Passwort ändern',
      currentPassword: 'Aktuelles Passwort',
      newPassword: 'Neues Passwort',
      confirmPassword: 'Passwort bestätigen',
      language: 'Sprache',
      timezone: 'Zeitzone',
      theme: 'Design',
      lightMode: 'Hell',
      darkMode: 'Dunkel',
      notifications: 'Benachrichtigungen',
      emailNotifications: 'E-Mail-Benachrichtigungen',
      pushNotifications: 'Push-Benachrichtigungen',
      settingsSaved: 'Einstellungen erfolgreich gespeichert',
      settingsError: 'Fehler beim Speichern der Einstellungen',
    },
    invoice: {
      title: 'Rechnung',
      createInvoice: 'Rechnung erstellen',
      invoiceNumber: 'Rechnungsnummer',
      invoiceDate: 'Rechnungsdatum',
      dueDate: 'Fälligkeitsdatum',
      billTo: 'Rechnung an',
      billFrom: 'Rechnung von',
      items: 'Positionen',
      addItem: 'Position hinzufügen',
      description: 'Beschreibung',
      quantity: 'Menge',
      unitPrice: 'Einzelpreis',
      amount: 'Betrag',
      subtotal: 'Zwischensumme',
      tax: 'MwSt.',
      total: 'Gesamt',
      notes: 'Notizen',
      termsAndConditions: 'Geschäftsbedingungen',
      previewInvoice: 'Rechnungsvorschau',
      downloadInvoice: 'Rechnung herunterladen',
      sendInvoice: 'Rechnung senden',
      invoiceCreated: 'Rechnung erfolgreich erstellt',
      invoiceSent: 'Rechnung erfolgreich gesendet',
    },
    businessScraper: {
      title: 'Firmendaten-Suche',
      searchBusinesses: 'Firmen suchen',
      searchQuery: 'Suchbegriff',
      location: 'Standort',
      radius: 'Radius',
      maxResults: 'Max. Ergebnisse',
      search: 'Suchen',
      searching: 'Suche läuft...',
      results: 'Ergebnisse',
      businessName: 'Firmenname',
      address: 'Adresse',
      phone: 'Telefon',
      website: 'Webseite',
      rating: 'Bewertung',
      reviews: 'Bewertungen',
      exportResults: 'Ergebnisse exportieren',
      exportPDF: 'Als PDF exportieren',
      exportCSV: 'Als CSV exportieren',
      noResults: 'Keine Ergebnisse gefunden',
    },
    status: {
      loading: 'Lädt...',
      saving: 'Speichert...',
      saved: 'Gespeichert',
      deleting: 'Löscht...',
      deleted: 'Gelöscht',
      uploading: 'Lädt hoch...',
      uploaded: 'Hochgeladen',
      downloading: 'Lädt herunter...',
      downloaded: 'Heruntergeladen',
      processing: 'Verarbeitet...',
      processed: 'Verarbeitet',
      error: 'Fehler',
      success: 'Erfolgreich',
      warning: 'Warnung',
      info: 'Info',
    },
    errors: {
      generic: 'Ein Fehler ist aufgetreten',
      notFound: 'Nicht gefunden',
      unauthorized: 'Nicht autorisiert',
      forbidden: 'Zugriff verweigert',
      serverError: 'Serverfehler',
      networkError: 'Netzwerkfehler',
      validationError: 'Validierungsfehler',
      required: 'Dieses Feld ist erforderlich',
      invalidEmail: 'Ungültige E-Mail-Adresse',
      invalidPhone: 'Ungültige Telefonnummer',
      invalidUrl: 'Ungültige URL',
      minLength: 'Mindestlänge nicht erreicht',
      maxLength: 'Maximallänge überschritten',
    },
    dateTime: {
      today: 'Heute',
      yesterday: 'Gestern',
      tomorrow: 'Morgen',
      thisWeek: 'Diese Woche',
      lastWeek: 'Letzte Woche',
      thisMonth: 'Dieser Monat',
      lastMonth: 'Letzter Monat',
      thisYear: 'Dieses Jahr',
      lastYear: 'Letztes Jahr',
      daysAgo: 'vor {n} Tagen',
      hoursAgo: 'vor {n} Stunden',
      minutesAgo: 'vor {n} Minuten',
      justNow: 'Gerade eben',
    },
  },
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      view: 'View',
      search: 'Search',
      filter: 'Filter',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      close: 'Close',
      open: 'Open',
      yes: 'Yes',
      no: 'No',
      all: 'All',
      none: 'None',
      select: 'Select',
      upload: 'Upload',
      download: 'Download',
      export: 'Export',
      import: 'Import',
      refresh: 'Refresh',
      settings: 'Settings',
      logout: 'Logout',
      profile: 'Profile',
      dashboard: 'Dashboard',
      new: 'New',
      create: 'Create',
      update: 'Update',
      confirm: 'Confirm',
      actions: 'Actions',
    },
    auth: {
      login: 'Login',
      loginTitle: 'Welcome Back',
      loginSubtitle: 'Sign in to your account',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      resetPassword: 'Reset Password',
      setPassword: 'Set Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      signIn: 'Sign In',
      signOut: 'Sign Out',
      emailPlaceholder: 'name@example.com',
      passwordPlaceholder: 'Your password',
      invalidCredentials: 'Invalid credentials',
      loginSuccess: 'Successfully logged in',
      logoutSuccess: 'Successfully logged out',
    },
    dashboard: {
      welcome: 'Welcome',
      welcomeBack: 'Welcome Back',
      overview: 'Overview',
      statistics: 'Statistics',
      recentActivity: 'Recent Activity',
      quickActions: 'Quick Actions',
      viewAll: 'View All',
    },
    nav: {
      dashboard: 'Dashboard',
      projects: 'Projects',
      clients: 'Clients',
      tickets: 'Tickets',
      files: 'Files',
      workOs: 'Work OS',
      tools: 'Tools',
      settings: 'Settings',
      logout: 'Logout',
      businessScraper: 'Business Data',
      invoice: 'Invoice',
    },
    projects: {
      title: 'Projects',
      myProjects: 'My Projects',
      allProjects: 'All Projects',
      activeProjects: 'Active Projects',
      completedProjects: 'Completed Projects',
      newProject: 'New Project',
      createProject: 'Create Project',
      editProject: 'Edit Project',
      projectDetails: 'Project Details',
      projectName: 'Project Name',
      projectDescription: 'Project Description',
      projectStatus: 'Project Status',
      projectCategory: 'Project Category',
      projectProgress: 'Project Progress',
      startDate: 'Start Date',
      endDate: 'End Date',
      dueDate: 'Due Date',
      client: 'Client',
      selectClient: 'Select Client',
      milestones: 'Milestones',
      timeline: 'Timeline',
      notes: 'Notes',
      projectCreated: 'Project created successfully',
      projectUpdated: 'Project updated successfully',
      projectDeleted: 'Project deleted successfully',
      noProjects: 'No projects found',
      total: 'Total',
      active: 'Active',
      completed: 'Completed',
      onHold: 'On Hold',
      cancelled: 'Cancelled',
    },
    clients: {
      title: 'Clients',
      allClients: 'All Clients',
      activeClients: 'Active Clients',
      archivedClients: 'Archived Clients',
      newClient: 'New Client',
      createClient: 'Create Client',
      editClient: 'Edit Client',
      clientDetails: 'Client Details',
      clientName: 'Client Name',
      companyName: 'Company Name',
      contactPerson: 'Contact Person',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      city: 'City',
      postalCode: 'Postal Code',
      country: 'Country',
      website: 'Website',
      notes: 'Notes',
      clientCreated: 'Client created successfully',
      clientUpdated: 'Client updated successfully',
      clientDeleted: 'Client deleted successfully',
      clientArchived: 'Client archived successfully',
      clientRestored: 'Client restored successfully',
      noClients: 'No clients found',
      totalClients: 'Total Clients',
      selectClient: 'Select Client',
    },
    tickets: {
      title: 'Tickets',
      supportTickets: 'Support Tickets',
      allTickets: 'All Tickets',
      myTickets: 'My Tickets',
      newTicket: 'New Ticket',
      createTicket: 'Create Ticket',
      ticketDetails: 'Ticket Details',
      ticketTitle: 'Ticket Title',
      ticketDescription: 'Ticket Description',
      ticketStatus: 'Ticket Status',
      ticketPriority: 'Ticket Priority',
      assignedTo: 'Assigned To',
      createdBy: 'Created By',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
      ticketCreated: 'Ticket created successfully',
      ticketUpdated: 'Ticket updated successfully',
      ticketClosed: 'Ticket closed successfully',
      noTickets: 'No tickets found',
      totalTickets: 'Total Tickets',
      openTickets: 'Open',
      inProgress: 'In Progress',
      resolved: 'Resolved',
      closed: 'Closed',
      priority: {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent',
      },
      status: {
        open: 'Open',
        inProgress: 'In Progress',
        resolved: 'Resolved',
        closed: 'Closed',
      },
    },
    files: {
      title: 'Files',
      allFiles: 'All Files',
      myFiles: 'My Files',
      recentFiles: 'Recent Files',
      uploadFile: 'Upload File',
      uploadFiles: 'Upload Files',
      downloadFile: 'Download File',
      deleteFile: 'Delete File',
      fileName: 'File Name',
      fileSize: 'File Size',
      fileType: 'File Type',
      uploadedBy: 'Uploaded By',
      uploadedAt: 'Uploaded At',
      fileUploaded: 'File uploaded successfully',
      fileDeleted: 'File deleted successfully',
      noFiles: 'No files found',
      dragAndDrop: 'Drag and drop files here or click to upload',
      selectFiles: 'Select Files',
    },
    workOs: {
      title: 'Work OS',
      boards: 'Boards',
      myBoards: 'My Boards',
      allBoards: 'All Boards',
      newBoard: 'New Board',
      createBoard: 'Create Board',
      boardName: 'Board Name',
      boardDescription: 'Board Description',
      items: 'Items',
      newItem: 'New Item',
      createItem: 'Create Item',
      itemName: 'Item Name',
      tableView: 'Table View',
      kanbanView: 'Kanban View',
      workspace: 'Workspace',
      workspaces: 'Workspaces',
    },
    settings: {
      title: 'Settings',
      accountSettings: 'Account Settings',
      profileSettings: 'Profile Settings',
      notificationSettings: 'Notification Settings',
      securitySettings: 'Security Settings',
      billingSettings: 'Billing Settings',
      systemSettings: 'System Settings',
      personalInfo: 'Personal Information',
      fullName: 'Full Name',
      email: 'Email',
      phone: 'Phone',
      avatar: 'Avatar',
      uploadAvatar: 'Upload Avatar',
      changePassword: 'Change Password',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      language: 'Language',
      timezone: 'Timezone',
      theme: 'Theme',
      lightMode: 'Light',
      darkMode: 'Dark',
      notifications: 'Notifications',
      emailNotifications: 'Email Notifications',
      pushNotifications: 'Push Notifications',
      settingsSaved: 'Settings saved successfully',
      settingsError: 'Error saving settings',
    },
    invoice: {
      title: 'Invoice',
      createInvoice: 'Create Invoice',
      invoiceNumber: 'Invoice Number',
      invoiceDate: 'Invoice Date',
      dueDate: 'Due Date',
      billTo: 'Bill To',
      billFrom: 'Bill From',
      items: 'Items',
      addItem: 'Add Item',
      description: 'Description',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      amount: 'Amount',
      subtotal: 'Subtotal',
      tax: 'Tax',
      total: 'Total',
      notes: 'Notes',
      termsAndConditions: 'Terms & Conditions',
      previewInvoice: 'Preview Invoice',
      downloadInvoice: 'Download Invoice',
      sendInvoice: 'Send Invoice',
      invoiceCreated: 'Invoice created successfully',
      invoiceSent: 'Invoice sent successfully',
    },
    businessScraper: {
      title: 'Business Data Scraper',
      searchBusinesses: 'Search Businesses',
      searchQuery: 'Search Query',
      location: 'Location',
      radius: 'Radius',
      maxResults: 'Max Results',
      search: 'Search',
      searching: 'Searching...',
      results: 'Results',
      businessName: 'Business Name',
      address: 'Address',
      phone: 'Phone',
      website: 'Website',
      rating: 'Rating',
      reviews: 'Reviews',
      exportResults: 'Export Results',
      exportPDF: 'Export as PDF',
      exportCSV: 'Export as CSV',
      noResults: 'No results found',
    },
    status: {
      loading: 'Loading...',
      saving: 'Saving...',
      saved: 'Saved',
      deleting: 'Deleting...',
      deleted: 'Deleted',
      uploading: 'Uploading...',
      uploaded: 'Uploaded',
      downloading: 'Downloading...',
      downloaded: 'Downloaded',
      processing: 'Processing...',
      processed: 'Processed',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Info',
    },
    errors: {
      generic: 'An error occurred',
      notFound: 'Not found',
      unauthorized: 'Unauthorized',
      forbidden: 'Forbidden',
      serverError: 'Server error',
      networkError: 'Network error',
      validationError: 'Validation error',
      required: 'This field is required',
      invalidEmail: 'Invalid email address',
      invalidPhone: 'Invalid phone number',
      invalidUrl: 'Invalid URL',
      minLength: 'Minimum length not met',
      maxLength: 'Maximum length exceeded',
    },
    dateTime: {
      today: 'Today',
      yesterday: 'Yesterday',
      tomorrow: 'Tomorrow',
      thisWeek: 'This Week',
      lastWeek: 'Last Week',
      thisMonth: 'This Month',
      lastMonth: 'Last Month',
      thisYear: 'This Year',
      lastYear: 'Last Year',
      daysAgo: '{n} days ago',
      hoursAgo: '{n} hours ago',
      minutesAgo: '{n} minutes ago',
      justNow: 'Just now',
    },
  },
  // French and Spanish would go here - I can add them if needed
  fr: {
    // ... French translations
  } as any,
  es: {
    // ... Spanish translations
  } as any,
};

// Translation hook
export function useTranslation(lang: Language = 'de'): Translations {
  return translations[lang] || translations.de;
}

// Helper function to get translation
export function t(lang: Language, key: string): string {
  const keys = key.split('.');
  let value: any = translations[lang] || translations.de;
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }
  
  return value || key;
}
