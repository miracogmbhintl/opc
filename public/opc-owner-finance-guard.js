(() => {
  /*
   * OPC_OWNER_FINANCE_GUARD_CACHE_ONLY_20260706_V2
   *
   * Kein Fetch und keine Datenbankabfrage.
   *
   * Das Rollenprofil wird durch opc-auth-cache und
   * MirakaDashboardShell verwaltet. Die sensiblen APIs
   * prüfen Berechtigungen weiterhin serverseitig.
   */

  try {
    const role =
      window.localStorage.getItem(
        'mco_user_role',
      ) || '';

    if (role) {
      document.documentElement.dataset
        .opcCachedRole = String(role)
        .trim()
        .toLowerCase();
    }
  } catch {
    // Keine Aktion erforderlich.
  }
})();
