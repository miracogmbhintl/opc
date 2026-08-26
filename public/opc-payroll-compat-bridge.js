(() => {
  if (window.__OPC_PAYROLL_COMPAT_RUNTIME__) {
    window.__OPC_PAYROLL_COMPAT_RUNTIME__.activate();
    return;
  }

  window.__OPC_PAYROLL_COMPAT_BRIDGE__ = true;

  const originalFetch = window.fetch.bind(window);
  const employeeDetailPattern = /^\/api\/opc\/employees\/([0-9a-f-]{36})\/?$/i;
  const employeePagePattern = /^\/mitarbeiter\/([0-9a-f-]{36})(?:\/|$)/i;
  let clickListenerActive = false;

  function isEmployeeDetailRoute() {
    return employeePagePattern.test(window.location.pathname);
  }

  function methodOf(input, init) {
    if (init && init.method) return String(init.method).toUpperCase();
    if (input instanceof Request) return String(input.method || 'GET').toUpperCase();
    return 'GET';
  }

  function requestUrl(input) {
    try {
      return new URL(input instanceof Request ? input.url : String(input), window.location.href);
    } catch {
      return null;
    }
  }

  window.fetch = (input, init) => {
    if (!isEmployeeDetailRoute()) return originalFetch(input, init);

    const method = methodOf(input, init);
    const url = requestUrl(input);

    if (method === 'GET' && url && url.origin === window.location.origin) {
      const match = url.pathname.match(employeeDetailPattern);
      if (match) {
        const replacement = new URL(url.href);
        replacement.pathname = `${url.pathname.replace(/\/$/, '')}/resilient-detail`;
        if (input instanceof Request) {
          return originalFetch(new Request(replacement.href, input), init);
        }
        return originalFetch(replacement.href, init);
      }
    }

    return originalFetch(input, init);
  };

  function currentEmployeeId() {
    return window.location.pathname.match(employeePagePattern)?.[1] || '';
  }

  function monthBounds(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return {
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  function selectedPeriod(container) {
    const monthInput = container.querySelector('input[type="month"]');
    if (monthInput && monthInput.value) return monthBounds(monthInput.value);

    const dates = Array.from(container.querySelectorAll('input[type="date"]'))
      .map((input) => input.value)
      .filter(Boolean);
    if (dates.length < 2) return null;
    return { from: dates[0], to: dates[1] };
  }

  function setBridgeMessage(root, message, isError) {
    if (!root) return;
    let node = root.querySelector('[data-opc-payroll-bridge-message]');
    if (!node) {
      node = document.createElement('div');
      node.setAttribute('data-opc-payroll-bridge-message', 'true');
      const banner = root.querySelector('.opc-payroll-banner');
      if (banner && banner.parentNode) banner.parentNode.insertBefore(node, banner.nextSibling);
      else root.prepend(node);
    }
    node.className = `opc-payroll-alert ${isError ? 'error' : 'success'}`;
    node.textContent = message;
  }

  function filenameFromDisposition(response, fallback) {
    const disposition = response.headers.get('content-disposition') || '';
    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const simpleMatch = disposition.match(/filename="?([^";]+)"?/i);
    const raw = utfMatch?.[1] || simpleMatch?.[1] || fallback;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  async function downloadPayrollPdf(button, container) {
    const employeeId = currentEmployeeId();
    const period = selectedPeriod(container);
    const root = button.closest('.opc-payroll-phase1');

    if (!employeeId) {
      setBridgeMessage(root, 'Mitarbeiter-ID konnte nicht bestimmt werden.', true);
      return;
    }
    if (!period || !period.from || !period.to || period.from > period.to) {
      setBridgeMessage(root, 'Bitte einen gültigen Abrechnungszeitraum wählen.', true);
      return;
    }

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = 'PDF wird erstellt…';
    setBridgeMessage(root, 'Lohnabrechnung wird serverseitig erstellt…', false);

    try {
      const query = new URLSearchParams({ from: period.from, to: period.to });
      const response = await originalFetch(
        `/api/opc/employees/${encodeURIComponent(employeeId)}/payroll-pdf?${query.toString()}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/pdf, application/json' },
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `PDF konnte nicht erstellt werden (${response.status}).`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/pdf')) {
        throw new Error('Der Server hat keine PDF-Datei zurückgegeben.');
      }

      const blob = await response.blob();
      if (!blob.size) throw new Error('Die erzeugte PDF-Datei ist leer.');

      const fallback = `Lohnabrechnung_${employeeId}_${period.from}_${period.to}.pdf`;
      const filename = filenameFromDisposition(response, fallback);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      window.setTimeout(() => {
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }, 5000);

      setBridgeMessage(root, 'Lohnabrechnung wurde erstellt und heruntergeladen.', false);
    } catch (error) {
      setBridgeMessage(
        root,
        error instanceof Error ? error.message : 'Lohnabrechnung konnte nicht heruntergeladen werden.',
        true,
      );
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }

  function handlePayrollClick(event) {
    if (!isEmployeeDetailRoute()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button.opc-payroll-button');
    if (!button) return;
    if (button.textContent?.trim() !== 'PDF') return;
    const container = button.closest('.opc-payroll-period');
    if (!container) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void downloadPayrollPdf(button, container);
  }

  function activate() {
    if (!isEmployeeDetailRoute()) {
      deactivate();
      return;
    }

    if (!clickListenerActive) {
      document.addEventListener('click', handlePayrollClick, true);
      clickListenerActive = true;
    }
  }

  function deactivate() {
    if (!clickListenerActive) return;
    document.removeEventListener('click', handlePayrollClick, true);
    clickListenerActive = false;
  }

  window.__OPC_PAYROLL_COMPAT_RUNTIME__ = { activate, deactivate };
  document.addEventListener('astro:page-load', activate);
  document.addEventListener('astro:before-swap', deactivate);
  activate();
})();
