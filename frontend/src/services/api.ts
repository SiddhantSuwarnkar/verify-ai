import {
  localApi,
  setDemoRole,
  getDemoRole,
  getDemoUsername,
  resetLocalDemoData
} from './localDataService';
import {
  Application,
  DocumentItem,
  Finding,
  Alert,
  AuditEvent,
  CatalogueCategory,
  CatalogueDocument,
  CatalogueCandidateRule,
  CatalogueExternalRef,
  Rule,
  RuleVersion,
  Connector,
  DashboardData,
  ManualVerificationTask,
  ComplianceChecklistItem
} from '../types';

export { setDemoRole, getDemoRole, getDemoUsername, resetLocalDemoData };

// Configuration for API backend
const customBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL;
const isStaticHost =
  typeof window !== 'undefined' &&
  !customBaseUrl &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

const API_BASE_URL = customBaseUrl || '/api';

// If on a static production host (like Vercel) without a specified VITE_API_BASE_URL,
// immediately use client-side local storage without making failing network calls.
let backendAvailable: boolean | null = isStaticHost ? false : null;
let lastConnectivityCheck = 0;
const CHECK_INTERVAL = 30000;

export const getPersistenceMode = (): 'backend-sqlite' | 'client-storage' => {
  return backendAvailable === true ? 'backend-sqlite' : 'client-storage';
};

export const getDocumentFileUrl = (document: DocumentItem): string | null => {
  if (!document.file_path) return null;

  if (backendAvailable === true) {
    return `${API_BASE_URL}/applications/documents/${encodeURIComponent(document.id)}/file`;
  }

  const fileName = document.file_path.split(/[\\/]/).pop();
  return fileName ? `/documents/${encodeURIComponent(fileName)}` : null;
};

const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'X-Demo-Role': getDemoRole(),
    'X-Demo-User': getDemoUsername()
  };
};

/**
 * Checks if the FastAPI backend is running and responding with valid JSON.
 */
export const checkBackendHealth = async (): Promise<boolean> => {
  if (isStaticHost) {
    backendAvailable = false;
    return false;
  }

  const now = Date.now();
  if (backendAvailable !== null && now - lastConnectivityCheck < CHECK_INTERVAL) {
    return backendAvailable;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${API_BASE_URL}/system/health`, {
      method: 'GET',
      headers: getHeaders(),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      backendAvailable = false;
      lastConnectivityCheck = now;
      return false;
    }

    backendAvailable = true;
    lastConnectivityCheck = now;
    return true;
  } catch (_e) {
    backendAvailable = false;
    lastConnectivityCheck = now;
    return false;
  }
};

/**
 * Executes a network call to the backend if available, otherwise delegates cleanly to localApi.
 * Robust against Vercel HTML rewrites that return <!doctype html> with HTTP 200.
 */
async function callBackendOrLocal<T>(
  backendPath: string,
  options: RequestInit | undefined,
  fallbackFn: () => Promise<T>
): Promise<T> {
  if (backendAvailable === false || isStaticHost) {
    return fallbackFn();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options?.headers || {})
      },
      signal: controller.signal
    };

    const res = await fetch(`${API_BASE_URL}${backendPath}`, mergedOptions);
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    // If server returned HTML (e.g. Vercel SPA rewrite fallback) rather than JSON, fall back to local
    if (!contentType.includes('application/json')) {
      backendAvailable = false;
      lastConnectivityCheck = Date.now();
      return fallbackFn();
    }

    if (res.ok) {
      backendAvailable = true;
      lastConnectivityCheck = Date.now();
      return (await res.json()) as T;
    } else {
      // 404, 500 or other server errors: gracefully fall back to localApi
      return fallbackFn();
    }
  } catch (_err: any) {
    backendAvailable = false;
    lastConnectivityCheck = Date.now();
    return fallbackFn();
  }
}

export const api = {
  // Applications
  getApplications: async (params?: Record<string, string>): Promise<Application[]> => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return callBackendOrLocal<Application[]>(
      `/applications${query}`,
      { method: 'GET' },
      () => localApi.getApplications(params)
    );
  },

  getApplicationDetail: async (id: string): Promise<Application> => {
    return callBackendOrLocal<Application>(
      `/applications/${id}`,
      { method: 'GET' },
      () => localApi.getApplicationDetail(id)
    );
  },

  runValidation: async (id: string) => {
    return callBackendOrLocal(
      `/applications/${id}/validate`,
      { method: 'POST' },
      () => localApi.runValidation(id)
    );
  },

  reviewFinding: async (findingId: string, action: string, reason: string) => {
    return callBackendOrLocal(
      `/findings/${findingId}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ action, reason })
      },
      () => localApi.reviewFinding(findingId, action, reason)
    );
  },

  requestClarification: async (id: string, notes: string) => {
    return callBackendOrLocal(
      `/applications/${id}/clarification`,
      {
        method: 'POST',
        body: JSON.stringify({ notes })
      },
      () => localApi.requestClarification(id, notes)
    );
  },

  escalateApplication: async (id: string, reason: string) => {
    return callBackendOrLocal(
      `/applications/${id}/escalate`,
      {
        method: 'POST',
        body: JSON.stringify({ reason })
      },
      () => localApi.escalateApplication(id, reason)
    );
  },

  recordDisposition: async (id: string, disposition: string, comment: string) => {
    return callBackendOrLocal(
      `/applications/${id}/disposition`,
      {
        method: 'POST',
        body: JSON.stringify({ disposition, comment })
      },
      () => localApi.recordDisposition(id, disposition, comment)
    );
  },

  getApplicationAudit: async (id: string): Promise<AuditEvent[]> => {
    return callBackendOrLocal<AuditEvent[]>(
      `/applications/${id}/audit`,
      { method: 'GET' },
      () => localApi.getApplicationAudit(id)
    );
  },

  // Manual Verification Tasks (Priority Feature)
  getManualTasks: async (applicationId: string, status?: string): Promise<ManualVerificationTask[]> => {
    const query = status ? `?status=${status}` : '';
    return callBackendOrLocal<ManualVerificationTask[]>(
      `/applications/${applicationId}/tasks${query}`,
      { method: 'GET' },
      () => localApi.getManualTasks(applicationId)
    );
  },

  updateManualTask: async (
    applicationId: string,
    taskId: string,
    action: string,
    remarks?: string,
    justification?: string,
    note?: string
  ): Promise<ManualVerificationTask> => {
    return callBackendOrLocal<ManualVerificationTask>(
      `/applications/${applicationId}/tasks/${taskId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ action, remarks, justification, note })
      },
      () => localApi.updateManualTask(applicationId, taskId, action, remarks, justification)
    );
  },

  // Compliance Checklist
  getComplianceChecklist: async (applicationId: string): Promise<ComplianceChecklistItem[]> => {
    return callBackendOrLocal<ComplianceChecklistItem[]>(
      `/applications/${applicationId}/checklist`,
      { method: 'GET' },
      () => localApi.getComplianceChecklist(applicationId)
    );
  },

  updateChecklistItem: async (
    applicationId: string,
    itemId: string,
    manualStatus: string,
    notes?: string
  ): Promise<ComplianceChecklistItem> => {
    return callBackendOrLocal<ComplianceChecklistItem>(
      `/applications/${applicationId}/checklist/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ manual_status: manualStatus, notes })
      },
      () => localApi.updateChecklistItem(applicationId, itemId, manualStatus, notes)
    );
  },

  // Intake Application
  intakeApplication: async (payload: {
    institution_name: string;
    institution_code?: string;
    academic_year?: string;
    nature_of_application: string;
    category_id?: number;
    trust_name?: string;
    intake_capacity?: number;
    land_area_acres?: number;
    built_up_area_sqm?: number;
    assigned_officer?: string;
    notes?: string;
  }): Promise<Application> => {
    return callBackendOrLocal<Application>(
      `/applications`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      () => localApi.intakeApplication(payload)
    );
  },

  // Dashboard & Connectors
  getDashboard: async (): Promise<DashboardData> => {
    return callBackendOrLocal<DashboardData>(
      `/system/dashboard`,
      { method: 'GET' },
      () => localApi.getDashboard()
    );
  },

  getUsers: async (): Promise<any[]> => {
    return localApi.getUsers();
  },

  seedDemo: async () => {
    return localApi.seedDemo();
  },

  getConnectors: async (): Promise<Connector[]> => {
    return localApi.getConnectors();
  },

  toggleConnector: async (id: string) => {
    return localApi.toggleConnector(id);
  },

  // Alerts
  getAlerts: async (params?: Record<string, string>): Promise<Alert[]> => {
    return localApi.getAlerts(params);
  },

  acknowledgeAlert: async (alertId: string) => {
    return localApi.acknowledgeAlert(alertId);
  },

  resolveAlert: async (alertId: string) => {
    return localApi.resolveAlert(alertId);
  },

  // Catalogue
  getCategories: async (params?: Record<string, string>): Promise<CatalogueCategory[]> => {
    return localApi.getCategories(params);
  },

  updateCategoryMapping: async (catId: number, mappingStatus: string, mappingNotes?: string) => {
    return localApi.updateCategoryMapping(catId, mappingStatus, mappingNotes);
  },

  getCatalogueDocuments: async (params?: Record<string, string>) => {
    return localApi.getCatalogueDocuments(params);
  },

  getCandidateRules: async (params?: Record<string, string>) => {
    return localApi.getCandidateRules(params);
  },

  updateCandidateLifecycle: async (candId: string, lifecycleStatus: string, reviewNotes?: string) => {
    return localApi.updateCandidateLifecycle(candId, lifecycleStatus, reviewNotes);
  },

  getExternalRefs: async (params?: Record<string, string>) => {
    return localApi.getExternalRefs(params);
  },

  getCatalogueCoverage: async () => {
    return localApi.getCatalogueCoverage();
  },

  // Governance Rules
  getRules: async (params?: Record<string, string>): Promise<Rule[]> => {
    return localApi.getRules(params);
  },

  getRuleDetail: async (id: string): Promise<Rule> => {
    return localApi.getRuleDetail(id);
  },

  createRuleDraft: async (payload: any): Promise<Rule> => {
    return localApi.createRuleDraft(payload);
  },

  submitRuleForReview: async (id: string): Promise<Rule> => {
    return localApi.submitRuleForReview(id);
  },

  approveRule: async (id: string, comment: string): Promise<Rule> => {
    return localApi.approveRule(id, comment);
  },

  rejectRule: async (id: string, reason: string): Promise<Rule> => {
    return localApi.rejectRule(id, reason);
  },

  getRuleVersions: async (id: string): Promise<RuleVersion[]> => {
    return localApi.getRuleVersions(id);
  },

  testRule: async (id: string, payload: any) => {
    return localApi.testRule(id, payload);
  },

  getHealth: async () => {
    return localApi.getHealth();
  }
};
