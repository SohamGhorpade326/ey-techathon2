import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description?: string;
  body?: string;
  message_id?: string;
  received_timestamp?: string;
  read?: boolean;
  source?: string;
};

function formatRelativeTime(iso?: string) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hours ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} days ago`;
}

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [selectedMail, setSelectedMail] = useState<NotificationItem | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string,string>>({});
  const _userHook = useUser();
  const isSignedIn = _userHook?.isSignedIn;
  const clerkUser = _userHook?.user;

  const fetchNotifications = async () => {
    try {
      // Fetch from primary API and also try RFPPilot2 (port 8000) as a source
      const primaryPromise = fetch(`${API}/notifications`).then((r) => r.ok ? r.json() : [] ).catch(() => []);
      const secondaryPromise = fetch(`http://127.0.0.1:8000/notifications`).then((r) => r.ok ? r.json() : [] ).catch(() => []);

      const [primaryData, secondaryData] = await Promise.all([primaryPromise, secondaryPromise]);

      const arr1 = Array.isArray(primaryData) ? primaryData : [];
      const arr2 = Array.isArray(secondaryData) ? secondaryData : [];

      // Merge and deduplicate by message_id or id
      const seen = new Set();
      const merged: NotificationItem[] = [];
      const pushItem = (it: any) => {
        const key = (it && (it.message_id || it.id)) || JSON.stringify(it);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(it);
        }
      };

      arr1.forEach(pushItem);
      arr2.forEach(pushItem);

      // Sort by received_timestamp desc if available
      merged.sort((a: any, b: any) => {
        const ta = a?.received_timestamp ? new Date(a.received_timestamp).getTime() : 0;
        const tb = b?.received_timestamp ? new Date(b.received_timestamp).getTime() : 0;
        return tb - ta;
      });

      setItems(merged);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
      setItems([]);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const t = setInterval(fetchNotifications, 15000);
    return () => clearInterval(t);
  }, []);

  const markAsRead = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  };

  const markAllAsRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const deleteNotification = async (id: string) => {
    // call backend to remove notification persistently
    const apiBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';
    try {
      const token = localStorage.getItem('token') || '';
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${apiBase}/notifications/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error('Failed to delete notification', e);
      alert('Failed to delete notification: ' + e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <Clock className="h-5 w-5 text-warning" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "discovery":
        return <Search className="h-5 w-5 text-info" />;
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getAgentColor = (source: string) => {
    switch (source) {
      case "Sales Agent":
        return "bg-agent-sales/10 text-agent-sales border-agent-sales/30";
      case "Technical Agent":
        return "bg-agent-technical/10 text-agent-technical border-agent-technical/30";
      case "Pricing Agent":
        return "bg-agent-pricing/10 text-agent-pricing border-agent-pricing/30";
      case "Master Agent":
        return "bg-agent-master/10 text-agent-master border-agent-master/30";
      case "gmail":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const filteredItems = useMemo(() => items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "unread") return !item.read;
    if (filter === "critical") return item.type === "critical";
    return true;
  }), [items, filter]);

  const unreadCount = items.filter((item) => !item.read).length;
  const criticalCount = items.filter((item) => item.type === "critical").length;

  return (
    <MainLayout
      title="Notifications"
      breadcrumbs={[
        { name: "Dashboard", href: "/dashboard" },
        { name: "Notifications" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-sm">
              {unreadCount} unread
            </Badge>
            <Badge className="bg-destructive/10 text-destructive border border-destructive/30">
              {criticalCount} critical
            </Badge>
          </div>
          <Button variant="outline" onClick={markAllAsRead}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="critical">Critical</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Notifications List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {filteredItems.map((item, index) => {
            // Use message_id as key for proper deduplication, fallback to id
            const itemKey = item.message_id || item.id;
            
            return (
            <motion.div
              key={itemKey}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "p-4 rounded-xl border transition-all",
                item.read
                  ? "bg-card border-border"
                  : "bg-primary/5 border-primary/20",
                item.type === "critical" && !item.read && "border-destructive/30 bg-destructive/5"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted/50">{getIcon(item.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3
                      className={cn(
                        "font-medium",
                        !item.read && "text-foreground",
                        item.read && "text-muted-foreground"
                      )}
                    >
                      {item.title}
                    </h3>
                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {item.description}
                  </p>
                    <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", getAgentColor(item.source || ""))}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      {item.source || ""}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.received_timestamp)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  
                  {item.body && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMail(item)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{item.title}</DialogTitle>
                          <DialogDescription>
                            From: {item.description}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {item.body}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  {/* Approve button for pending_approval notifications (visible to super_admin) */}
                  {item.type === 'pending_approval' && (() => {
                    // determine current role from localStorage user or Clerk
                    const getCurrentRole = () => {
                      try {
                        const meta = (clerkUser as any)?.publicMetadata || (clerkUser as any)?.public_metadata || {};
                        if (meta && meta.role) return String(meta.role || '');
                      } catch {}
                      try { return JSON.parse(localStorage.getItem('user') || '{}').role || ''; } catch { return ''; }
                    };
                    const currentRole = getCurrentRole();
                    if (!currentRole || String(currentRole).toLowerCase().replace(/[_\s]/g,'') !== 'superadmin' && String(currentRole).toLowerCase().replace(/[_\s]/g,'') !== 'super_admin') return null;

                    const roleOptions = [
                      { value: 'super_admin', label: 'Super Admin' },
                      { value: 'product', label: 'Product' },
                      { value: 'pricing', label: 'Pricing' },
                      { value: 'technical', label: 'Technical' },
                      { value: 'sales', label: 'Sales' },
                    ];

                    const selected = selectedRoles[item.message_id || item.id] || 'product';

                    return (
                      <div className="flex items-center gap-2">
                        <select
                          value={selected}
                          onChange={(e) => setSelectedRoles(s => ({ ...s, [item.message_id || item.id]: e.target.value }))}
                          className="text-sm rounded border px-2 py-1 bg-card"
                        >
                          {roleOptions.map(ro => <option key={ro.value} value={ro.value}>{ro.label}</option>)}
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const role = selectedRoles[item.message_id || item.id] || selected;
                            if (!role) return;
                            const apiBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';
                            try {
                              const token = localStorage.getItem('token') || '';
                              const headers: Record<string,string> = { 'Content-Type': 'application/json' };
                              if (token) headers.Authorization = `Bearer ${token}`;
                              const res = await fetch(`${apiBase}/admin/approve-user`, {
                                method: 'POST', headers,
                                body: JSON.stringify({ clerk_user_id: item.message_id, role })
                              });
                              if (!res.ok) throw new Error(await res.text());
                              alert('User approved');
                              fetchNotifications();
                            } catch (e) {
                              console.error('Approve failed', e);
                              alert('Approve failed: ' + e);
                            }
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })()}
                  {!item.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(item.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteNotification(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No notifications</p>
            </div>
          )}
        </motion.div>
      </div>
    </MainLayout>
  );
}
