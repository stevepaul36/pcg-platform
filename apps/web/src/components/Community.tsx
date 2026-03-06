"use client";

import { useState } from "react";
import { useStore, useAnnouncements, useImprovements, useHasVotedFor } from "../store";
import {
  Megaphone, Lightbulb, ChevronDown, Loader2,
  Pin, AlertTriangle, Sparkles, Wrench, Bug, Zap, Palette,
  ArrowUp
} from "lucide-react";

export function Community() {
  const [tab, setTab] = useState<"announcements" | "improvements">("announcements");

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Community</h1>
        <p className="text-sm text-gcp-muted mt-1">Platform announcements and improvement tracker</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("announcements")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "announcements" ? "bg-white shadow-sm text-gcp-text" : "text-gcp-muted hover:text-gcp-text"
          }`}
        >
          <Megaphone className="w-3.5 h-3.5 inline mr-1.5" />Announcements
        </button>
        <button
          onClick={() => setTab("improvements")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "improvements" ? "bg-white shadow-sm text-gcp-text" : "text-gcp-muted hover:text-gcp-text"
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5 inline mr-1.5" />Improvements
        </button>
      </div>

      {tab === "announcements" ? <AnnouncementsFeed /> : <ImprovementsList />}
    </div>
  );
}

function AnnouncementsFeed() {
  const announcements = useAnnouncements();
  const loading = useStore((s) => s.loading.announcements);
  const pagination = useStore((s) => s.pagination.announcements);
  const loadMore = useStore((s) => s.loadAnnouncements);

  const typeConfig: Record<string, { icon: React.ReactNode; bg: string; border: string }> = {
    info:        { icon: <Megaphone className="w-4 h-4 text-gcp-blue" />,    bg: "bg-blue-50",   border: "border-l-gcp-blue" },
    warning:     { icon: <AlertTriangle className="w-4 h-4 text-yellow-600" />, bg: "bg-yellow-50", border: "border-l-yellow-500" },
    feature:     { icon: <Sparkles className="w-4 h-4 text-purple-600" />,   bg: "bg-purple-50", border: "border-l-purple-500" },
    maintenance: { icon: <Wrench className="w-4 h-4 text-gray-600" />,       bg: "bg-gray-50",   border: "border-l-gray-400" },
  };

  if (loading && announcements.length === 0) {
    return <div className="card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gcp-blue" /></div>;
  }

  if (announcements.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Megaphone className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
        <p className="text-sm text-gcp-muted">No announcements yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((ann) => {
        const config = typeConfig[ann.type] || typeConfig.info;
        return (
          <div key={ann.id} className={`card border-l-4 ${config.border}`}>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
                  {config.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{ann.title}</h3>
                    {ann.pinned && <Pin className="w-3 h-3 text-gcp-blue" />}
                  </div>
                  <p className="text-sm text-gcp-muted mt-1 whitespace-pre-line">{ann.body}</p>
                  <p className="text-xs text-gcp-muted mt-2">
                    {new Date(ann.publishedAt).toLocaleDateString()} · {ann.authorEmail}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {pagination.hasNextPage && (
        <button onClick={() => loadMore(pagination.nextCursor!)} disabled={loading}
          className="btn-secondary text-sm flex items-center gap-1 mx-auto">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Load more
        </button>
      )}
    </div>
  );
}

function ImprovementsList() {
  const improvements = useImprovements();
  const loading = useStore((s) => s.loading.improvements);
  const pagination = useStore((s) => s.pagination.improvements);
  const loadMore = useStore((s) => s.loadImprovements);

  if (loading && improvements.length === 0) {
    return <div className="card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gcp-blue" /></div>;
  }

  if (improvements.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Lightbulb className="w-10 h-10 text-gcp-muted mx-auto mb-3" />
        <p className="text-sm text-gcp-muted">No improvements tracked yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {improvements.map((imp) => <ImprovementCard key={imp.id} improvement={imp} />)}
      {pagination.hasNextPage && (
        <button onClick={() => loadMore(pagination.nextCursor!)} disabled={loading}
          className="btn-secondary text-sm flex items-center gap-1 mx-auto mt-3">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Load more
        </button>
      )}
    </div>
  );
}

function ImprovementCard({ improvement }: { improvement: any }) {
  const upvote = useStore((s) => s.upvoteImprovement);
  const addToast = useStore((s) => s.addToast);
  const hasVoted = useHasVotedFor(improvement.id);

  const handleVote = async () => {
    try { await upvote(improvement.id); }
    catch (err: any) {
      if (err.code === "ALREADY_VOTED") addToast("Already voted", "info");
      else addToast(err.message, "error");
    }
  };

  const statusCls: Record<string, string> = {
    planned:     "bg-gray-100 text-gcp-muted",
    in_progress: "bg-blue-50 text-gcp-blue",
    completed:   "bg-green-50 text-gcp-green",
    cancelled:   "bg-red-50 text-gcp-red",
  };

  const catIcon: Record<string, React.ReactNode> = {
    feature:     <Sparkles className="w-3.5 h-3.5" />,
    bug:         <Bug className="w-3.5 h-3.5" />,
    performance: <Zap className="w-3.5 h-3.5" />,
    ux:          <Palette className="w-3.5 h-3.5" />,
  };

  const priorityCls: Record<string, string> = {
    low:      "text-gray-400",
    medium:   "text-gcp-yellow",
    high:     "text-orange-500",
    critical: "text-gcp-red",
  };

  return (
    <div className="card flex items-stretch">
      {/* Vote button */}
      <button
        onClick={handleVote}
        disabled={hasVoted}
        className={`w-16 shrink-0 flex flex-col items-center justify-center gap-0.5 border-r border-gcp-border transition-colors
          ${hasVoted ? "bg-blue-50 text-gcp-blue" : "hover:bg-gray-50 text-gcp-muted"}`}
      >
        <ArrowUp className="w-4 h-4" />
        <span className="text-sm font-semibold">{improvement.votes}</span>
      </button>

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-sm">{improvement.title}</h3>
          <span className={`badge ${statusCls[improvement.status] || ""}`}>
            {improvement.status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-gcp-muted mt-1 line-clamp-2">{improvement.description}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gcp-muted">
          <span className="flex items-center gap-1">{catIcon[improvement.category]}{improvement.category}</span>
          <span className={`flex items-center gap-1 ${priorityCls[improvement.priority] || ""}`}>
            ● {improvement.priority}
          </span>
          <span>{improvement.authorEmail}</span>
        </div>
      </div>
    </div>
  );
}
