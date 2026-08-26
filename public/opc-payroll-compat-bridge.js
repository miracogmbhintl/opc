(() => {
  const marker = '__opcPayrollCompatBridgeInstalled__';

  if (window[marker]) return;
  window[marker] = true;

  // Keep only the resilient employee-detail compatibility layer.
  //
  // IMPORTANT:
  // Payroll PDF clicks are intentionally NOT intercepted here anymore.
  // EmployeeDetailPage owns payroll generation and uses:
  //
  //   payroll-preview
  //       -> buildPayrollHtml()
  //       -> OPC payroll HTML template
  //       -> renderHtmlToPdfBase64()
  //
  // The previous compatibility bridge intercepted the click and forced the
  // legacy /payroll-pdf jsPDF endpoint, which produced the plain PDF instead
  // of the standard OPC document design.

  const nativeFetch = window.fetch.bind(window);

  function requestUrl(input) {
    try {
      if (input instanceof Request) {
        return new URL(input.url, window.location.origin);
      }

      return new URL(String(input), window.location.origin);
    } catch {
      return null;
    }
  }

  function requestMethod(input, init) {
    if (init && init.method) {
      return String(init.method).toUpperCase();
    }

    if (input instanceof Request) {
      return String(input.method || 'GET').toUpperCase();
    }

    return 'GET';
  }

  window.fetch = function opcPayrollCompatFetch(input, init) {
    const url = requestUrl(input);
    const method = requestMethod(input, init);

    if (url && method === 'GET') {
      const match = url.pathname.match(
        /^\/api\/opc\/employees\/([^/]+)$/i,
      );

      if (match) {
        const employeeId = decodeURIComponent(match[1] || '');

        if (employeeId) {
          const resilientUrl = new URL(
            `/api/opc/employees/${encodeURIComponent(employeeId)}/resilient-detail`,
            window.location.origin,
          );

          resilientUrl.search = url.search;

          if (input instanceof Request) {
            const original = new Request(input, init);
            const rewritten = new Request(
              resilientUrl.toString(),
              original,
            );

            return nativeFetch(rewritten);
          }

          return nativeFetch(resilientUrl.toString(), init);
        }
      }
    }

    return nativeFetch(input, init);
  };
})();
