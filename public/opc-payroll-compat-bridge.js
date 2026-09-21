(() => {
  const marker = '__opcPayrollCompatBridgeInstalled__';

  if (window[marker]) return;
  window[marker] = true;

  // OPC_PERFORMANCE_STAGE2_20260904
  //
  // The former compatibility layer rewrote every normal employee-detail GET
  // request to /resilient-detail. That endpoint no longer exists in the
  // current application, so every employee page generated an avoidable 404
  // before falling back to the real /api/opc/employees/[id] endpoint.
  //
  // Payroll PDF clicks are owned by EmployeeDetailPage and no longer need a
  // global fetch interception. Keep this tiny marker-only file so existing
  // script includes remain harmless and backward compatible.
})();
