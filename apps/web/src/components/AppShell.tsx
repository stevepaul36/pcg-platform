"use client";

import { useEffect } from "react";
import { useStore } from "../store";
import { useLiveBillingClock } from "../hooks/useLiveBillingClock";
import { useMetricsPolling } from "../hooks/useMetricsPolling";
import { useSessionTimer } from "../hooks/useSessionTimer";
import { Sidebar } from "./Sidebar";
import { Dashboard } from "./Dashboard";
import { ComputeEngine } from "./ComputeEngine";
import { CloudStorage } from "./CloudStorage";
import { CloudSQL } from "./CloudSQL";
import { IAMPanel } from "./IAMPanel";
import { ActivityLog } from "./ActivityLog";
import { Community } from "./Community";
import { RightPanel } from "./RightPanel";
import { BigQueryPanel } from "./BigQuery";
import { PubSubPanel } from "./PubSub";
import { CloudFunctions } from "./CloudFunctions";
import { GKEPanel } from "./GKE";
import { CloudRunPanel } from "./CloudRun";
import { NetworkingPanel } from "./Networking";
import { SecurityPanel } from "./SecurityPanel";
import { VertexAIPanel } from "./VertexAI";
import { DataflowPanel } from "./Dataflow";
import { MonitoringPanel } from "./Monitoring";
import { CloudBuildPanel } from "./CloudBuild";
import { ArtifactRegistryPanel } from "./ArtifactRegistry";
import { SchedulerPanel } from "./Scheduler";
import { ApiGatewayPanel } from "./ApiGateway";
import { MemorystorePanel } from "./Memorystore";
import { CloudArmorPanel } from "./CloudArmor";
import { FirestorePanel } from "./Firestore";
import { CloudLoggingPanel } from "./CloudLogging";
import { CloudTasksPanel } from "./CloudTasks";
import { DataprocPanelPanel } from "./DataprocPanel";
import { CloudCDNPanel } from "./CloudCDN";
import { FirewallRulesPanel } from "./FirewallRules";
import { ServiceAccountsPanel } from "./ServiceAccounts";
import { BudgetsPanelPanel } from "./BudgetsPanel";
import { WorkflowsPanelPanel } from "./WorkflowsPanel";
import { CloudDeployPanelPanel } from "./CloudDeployPanel";
import { BillingDashboard } from "./BillingDashboard";
import { QuotasPanel } from "./QuotasPanel";
import { ResourceManagerPanel } from "./ResourceManager";
import { Clock, DollarSign, Server, ChevronLeft, ChevronRight } from "lucide-react";

export function AppShell() {
  const page = useStore((s) => s.page);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const projectName = useStore((s) => s.projectName);
  const totalSpend = useStore((s) => s.totalSpendUSD);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const projectId = useStore((s) => s.projectId);
  const { formattedSession, runningCount } = useSessionTimer();

  useLiveBillingClock();
  useMetricsPolling();

  const loadVMs = useStore((s) => s.loadVMs);
  const loadBuckets = useStore((s) => s.loadBuckets);
  const loadSQL = useStore((s) => s.loadSQL);
  const loadIAM = useStore((s) => s.loadIAM);
  const loadLogs = useStore((s) => s.loadLogs);
  const loadAnnouncements = useStore((s) => s.loadAnnouncements);
  const loadImprovements = useStore((s) => s.loadImprovements);

  // FIX: reload data on every login (projectId change), not just on first mount
  useEffect(() => {
    if (!isAuthenticated || !projectId) return;
    loadVMs();
    loadBuckets();
    loadSQL();
    loadIAM();
    loadLogs();
    loadAnnouncements();
    loadImprovements();
  }, [isAuthenticated, projectId]);

  const renderPage = () => {
    switch (page) {
      case "dashboard":  return <Dashboard />;
      case "compute":    return <ComputeEngine />;
      case "storage":    return <CloudStorage />;
      case "sql":        return <CloudSQL />;
      case "iam":        return <IAMPanel />;
      case "logs":       return <ActivityLog />;
      case "community":  return <Community />;
      case "bigquery":   return <BigQueryPanel />;
      case "pubsub":     return <PubSubPanel />;
      case "functions":  return <CloudFunctions />;
      case "gke":        return <GKEPanel />;
      case "cloudrun":   return <CloudRunPanel />;
      case "networking": return <NetworkingPanel />;
      case "security":   return <SecurityPanel />;
      case "vertexai":   return <VertexAIPanel />;
      case "dataflow":   return <DataflowPanel />;
      case "monitoring": return <MonitoringPanel />;
      case "cloudbuild": return <CloudBuildPanel />;
      case "artifacts":  return <ArtifactRegistryPanel />;
      case "scheduler":  return <SchedulerPanel />;
      case "apigateway": return <ApiGatewayPanel />;
      case "memorystore":return <MemorystorePanel />;
      case "cloudarmor": return <CloudArmorPanel />;
      case "firestore":  return <FirestorePanel />;
      case "logging":    return <CloudLoggingPanel />;
      case "tasks":      return <CloudTasksPanel />;
      case "dataproc":   return <DataprocPanelPanel />;
      case "cdn":        return <CloudCDNPanel />;
      case "firewall":   return <FirewallRulesPanel />;
      case "serviceaccounts": return <ServiceAccountsPanel />;
      case "budgets":    return <BudgetsPanelPanel />;
      case "workflows":  return <WorkflowsPanelPanel />;
      case "deploy":     return <CloudDeployPanelPanel />;
      case "billingdash": return <BillingDashboard />;
      case "quotas":     return <QuotasPanel />;
      case "resourcemgr": return <ResourceManagerPanel />;
      default:           return <Dashboard />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="h-12 bg-white border-b border-gcp-border flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="btn-icon">
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gcp-blue rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="font-medium text-sm">{projectName || "PCG Platform"}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gcp-muted">
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" />
            <span>{runningCount} running</span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            <span className="font-mono">${totalSpend.toFixed(4)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono">{formattedSession}</span>
          </div>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-gcp-bg p-6">
          {renderPage()}
        </main>
        <RightPanel />
      </div>
    </div>
  );
}
