import { useEffect } from 'react';
import EmployeeDetailPage from './EmployeeDetailPage';

type EmployeeDetailAdminWrapperProps = {
  employeeId: string;
};

export default function EmployeeDetailAdminWrapper({
  employeeId,
}: EmployeeDetailAdminWrapperProps) {
  useEffect(() => {
    const marker = '__opcPayrollCompatBridgeScriptLoaded__';
    const scopedWindow = window as Window & Record<string, unknown>;

    if (scopedWindow[marker]) return;
    scopedWindow[marker] = true;

    const script = document.createElement('script');
    script.src = '/opc-payroll-compat-bridge.js';
    script.async = false;
    script.dataset.opcPayrollCompatBridge = 'true';

    document.head.appendChild(script);
  }, []);

  // EmployeeDetailPage is the canonical OPC employee UI.
  //
  // The old wrapper rendered a second legacy employee editor before this component,
  // outside MirakaDashboardShell. That produced a second editor underneath
  // the fixed sidebar and caused employee data to be edited through two
  // competing save paths.
  return <EmployeeDetailPage employeeId={employeeId} />;
}
