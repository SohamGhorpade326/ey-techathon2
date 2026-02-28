import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { UserManagement } from "@/components/UserManagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Building2,
  Lock,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  User,
  Users,
} from "lucide-react";

import { useT } from "@/hooks/useT";

export default function Settings() {
  const [notifications, setNotifications] = useState({
    email: true,
    deadlineAlerts: true,
    agentUpdates: true,
    weeklyDigest: false,
  });

  const { t, registerText } = useT();

  useEffect(() => {
    try {
      registerText && registerText("Settings.title", "Settings");
      registerText && registerText("Settings.breadcrumbs.dashboard", "Dashboard");
      registerText && registerText("Settings.tab.profile", "Profile");
      registerText && registerText("Settings.tab.company", "Company");
      registerText && registerText("Settings.tab.notifications", "Notifications");
      registerText && registerText("Settings.tab.agents", "AI Agents");
      registerText && registerText("Settings.tab.security", "Security");
      registerText && registerText("Settings.profile.heading", "Personal Information");
      registerText && registerText("Settings.profile.description", "Update your personal details");
      registerText && registerText("Settings.profile.fullName", "Full Name");
      registerText && registerText("Settings.profile.jobTitle", "Job Title");
      registerText && registerText("Settings.profile.email", "Email Address");
      registerText && registerText("Settings.profile.phone", "Phone Number");
      registerText && registerText("Settings.company.heading", "Company Details");
      registerText && registerText("Settings.company.description", "Used in proposal generation and bid responses");
      registerText && registerText("Settings.company.name", "Company Name");
      registerText && registerText("Settings.company.regno", "Registration Number");
      registerText && registerText("Settings.company.gst", "GST Number");
      registerText && registerText("Settings.company.pan", "PAN Number");
      registerText && registerText("Settings.company.address", "Registered Address");
      registerText && registerText("Settings.notifications.heading", "Notification Preferences");
      registerText && registerText("Settings.notifications.description", "Configure how you receive alerts and updates");
      registerText && registerText("Settings.notifications.email.label", "Email Notifications");
      registerText && registerText("Settings.notifications.email.desc", "Receive notifications via email");
      registerText && registerText("Settings.notifications.deadline.label", "Deadline Alerts");
      registerText && registerText("Settings.notifications.deadline.desc", "Get notified about approaching RFP deadlines");
      registerText && registerText("Settings.notifications.agent.label", "Agent Activity Updates");
      registerText && registerText("Settings.notifications.agent.desc", "Receive updates when AI agents complete tasks");
      registerText && registerText("Settings.notifications.weekly.label", "Weekly Digest");
      registerText && registerText("Settings.notifications.weekly.desc", "Summary of all RFP activity sent weekly");
      registerText && registerText("Settings.agents.heading", "AI Agent Configuration");
      registerText && registerText("Settings.agents.description", "Configure autonomous agent behavior");
      registerText && registerText("Settings.agents.sales.freq", "Sales Agent - Scan Frequency");
      registerText && registerText("Settings.agents.realtime", "Real-time");
      registerText && registerText("Settings.agents.hourly", "Every Hour");
      registerText && registerText("Settings.agents.daily", "Daily");
      registerText && registerText("Settings.agents.autoAnalyze", "Auto-Analyze New RFPs");
      registerText && registerText("Settings.agents.enabled", "Enabled");
      registerText && registerText("Settings.agents.disabled", "Disabled");
      registerText && registerText("Settings.agents.prompt", "Prompt First");
      registerText && registerText("Settings.agents.threshold", "Minimum Spec-Match Threshold for Auto-Pricing");
      registerText && registerText("Settings.agents.threshold90", "90% or higher");
      registerText && registerText("Settings.agents.threshold80", "80% or higher");
      registerText && registerText("Settings.agents.threshold70", "70% or higher");
      registerText && registerText("Settings.agents.threshold60", "60% or higher");
      registerText && registerText("Settings.agents.noteLabel", "Note:");
      registerText && registerText("Settings.agents.noteText", "Agents operate autonomously but require human approval for final bid submission.");
      registerText && registerText("Settings.security.heading", "Security Settings");
      registerText && registerText("Settings.security.description", "Manage your account security");
      registerText && registerText("Settings.security.changePassword", "Change Password");
      registerText && registerText("Settings.security.currentPassword", "Current Password");
      registerText && registerText("Settings.security.newPassword", "New Password");
      registerText && registerText("Settings.security.confirmPassword", "Confirm New Password");
      registerText && registerText("Settings.security.updatePassword", "Update Password");
      registerText && registerText("Settings.security.twoFA", "Two-Factor Authentication");
      registerText && registerText("Settings.security.twoFADesc", "Add an extra layer of security to your account");
      registerText && registerText("Settings.security.activeSessions", "Active Sessions");
      registerText && registerText("Settings.security.viewSessions", "View Sessions");
      registerText && registerText("Settings.saveChanges", "Save Changes");
    } catch (e) {}
  }, [registerText]);

  // Get user role from localStorage
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <MainLayout
      title={t ? t("Settings.title", "Settings") : "Settings"}
      breadcrumbs={[
        { name: t ? t("Settings.breadcrumbs.dashboard", "Dashboard") : "Dashboard", href: "/dashboard" },
        { name: t ? t("Settings.title", "Settings") : "Settings" },
      ]}
    >
      <div className="max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                {t ? t("Settings.tab.profile", "Profile") : "Profile"}
              </TabsTrigger>
              <TabsTrigger value="company" className="gap-2">
                <Building2 className="h-4 w-4" />
                {t ? t("Settings.tab.company", "Company") : "Company"}
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                {t ? t("Settings.tab.notifications", "Notifications") : "Notifications"}
              </TabsTrigger>
              <TabsTrigger value="agents" className="gap-2">
                <Sparkles className="h-4 w-4" />
                {t ? t("Settings.tab.agents", "AI Agents") : "AI Agents"}
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Lock className="h-4 w-4" />
                {t ? t("Settings.tab.security", "Security") : "Security"}
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="users" className="gap-2">
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
              )}
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-6 space-y-6"
              >
                <div>
                  <h3 className="font-semibold mb-1">{t ? t("Settings.profile.heading","Personal Information") : "Personal Information"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t ? t("Settings.profile.description","Update your personal details") : "Update your personal details"}
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{t ? t("Settings.profile.fullName","Full Name") : "Full Name"}</Label>
                    <Input defaultValue="Rajesh Kumar" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t ? t("Settings.profile.jobTitle","Job Title") : "Job Title"}</Label>
                    <Input defaultValue="Sales Lead" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t ? t("Settings.profile.email","Email Address") : "Email Address"}</Label>
                    <Input defaultValue="rajesh.kumar@company.com" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t ? t("Settings.profile.phone","Phone Number") : "Phone Number"}</Label>
                    <Input defaultValue="+91 98765 43210" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    {t ? t("Settings.saveChanges","Save Changes") : "Save Changes"}
                  </Button>
                </div>
              </motion.div>
            </TabsContent>

            {/* Company Tab */}
            <TabsContent value="company">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-6 space-y-6"
              >
                <div>
                  <h3 className="font-semibold mb-1">{t ? t("Settings.company.heading","Company Details") : "Company Details"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t ? t("Settings.company.description","Used in proposal generation and bid responses") : "Used in proposal generation and bid responses"}
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{t ? t("Settings.company.name","Company Name") : "Company Name"}</Label>
                    <Input defaultValue="Premier Cables India Pvt. Ltd." />
                  </div>
                  <div className="space-y-2">
                    <Label>{t ? t("Settings.company.regno","Registration Number") : "Registration Number"}</Label>
                    <Input defaultValue="U31200MH2010PTC123456" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t ? t("Settings.company.gst","GST Number") : "GST Number"}</Label>
                    <Input defaultValue="27AABCP1234R1ZX" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t ? t("Settings.company.pan","PAN Number") : "PAN Number"}</Label>
                    <Input defaultValue="AABCP1234R" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>{t ? t("Settings.company.address","Registered Address") : "Registered Address"}</Label>
                    <Input defaultValue="Plot No. 45, MIDC Industrial Area, Thane, Maharashtra 400601" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    {t ? t("Settings.saveChanges","Save Changes") : "Save Changes"}
                  </Button>
                </div>
              </motion.div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-6 space-y-6"
              >
                <div>
                  <h3 className="font-semibold mb-1">{t ? t("Settings.notifications.heading","Notification Preferences") : "Notification Preferences"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t ? t("Settings.notifications.description","Configure how you receive alerts and updates") : "Configure how you receive alerts and updates"}
                  </p>
                </div>
                <Separator />
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t ? t("Settings.notifications.email.label","Email Notifications") : "Email Notifications"}</p>
                      <p className="text-sm text-muted-foreground">
                        {t ? t("Settings.notifications.email.desc","Receive notifications via email") : "Receive notifications via email"}
                      </p>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, email: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t ? t("Settings.notifications.deadline.label","Deadline Alerts") : "Deadline Alerts"}</p>
                      <p className="text-sm text-muted-foreground">
                        {t ? t("Settings.notifications.deadline.desc","Get notified about approaching RFP deadlines") : "Get notified about approaching RFP deadlines"}
                      </p>
                    </div>
                    <Switch
                      checked={notifications.deadlineAlerts}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, deadlineAlerts: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t ? t("Settings.notifications.agent.label","Agent Activity Updates") : "Agent Activity Updates"}</p>
                      <p className="text-sm text-muted-foreground">
                        {t ? t("Settings.notifications.agent.desc","Receive updates when AI agents complete tasks") : "Receive updates when AI agents complete tasks"}
                      </p>
                    </div>
                    <Switch
                      checked={notifications.agentUpdates}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, agentUpdates: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t ? t("Settings.notifications.weekly.label","Weekly Digest") : "Weekly Digest"}</p>
                      <p className="text-sm text-muted-foreground">
                        {t ? t("Settings.notifications.weekly.desc","Summary of all RFP activity sent weekly") : "Summary of all RFP activity sent weekly"}
                      </p>
                    </div>
                    <Switch
                      checked={notifications.weeklyDigest}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, weeklyDigest: checked }))
                      }
                    />
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* AI Agents Tab */}
            <TabsContent value="agents">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-6 space-y-6"
              >
                <div>
                  <h3 className="font-semibold mb-1">{t ? t("Settings.agents.heading","AI Agent Configuration") : "AI Agent Configuration"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t ? t("Settings.agents.description","Configure autonomous agent behavior") : "Configure autonomous agent behavior"}
                  </p>
                </div>
                <Separator />
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>{t ? t("Settings.agents.sales.freq","Sales Agent - Scan Frequency") : "Sales Agent - Scan Frequency"}</Label>
                      <Select defaultValue="hourly">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">{t ? t("Settings.agents.realtime","Real-time") : "Real-time"}</SelectItem>
                          <SelectItem value="hourly">{t ? t("Settings.agents.hourly","Every Hour") : "Every Hour"}</SelectItem>
                          <SelectItem value="daily">{t ? t("Settings.agents.daily","Daily") : "Daily"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t ? t("Settings.agents.autoAnalyze","Auto-Analyze New RFPs") : "Auto-Analyze New RFPs"}</Label>
                      <Select defaultValue="enabled">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enabled">{t ? t("Settings.agents.enabled","Enabled") : "Enabled"}</SelectItem>
                          <SelectItem value="disabled">{t ? t("Settings.agents.disabled","Disabled") : "Disabled"}</SelectItem>
                          <SelectItem value="prompt">{t ? t("Settings.agents.prompt","Prompt First") : "Prompt First"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t ? t("Settings.agents.threshold","Minimum Spec-Match Threshold for Auto-Pricing") : "Minimum Spec-Match Threshold for Auto-Pricing"}</Label>
                    <Select defaultValue="70">
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90">{t ? t("Settings.agents.threshold90","90% or higher") : "90% or higher"}</SelectItem>
                        <SelectItem value="80">{t ? t("Settings.agents.threshold80","80% or higher") : "80% or higher"}</SelectItem>
                        <SelectItem value="70">{t ? t("Settings.agents.threshold70","70% or higher") : "70% or higher"}</SelectItem>
                        <SelectItem value="60">{t ? t("Settings.agents.threshold60","60% or higher") : "60% or higher"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-4 bg-info/10 border border-info/30 rounded-lg">
                    <p className="text-sm text-info">
                      <strong>{t ? t("Settings.agents.noteLabel","Note:") : "Note:"}</strong> {t ? t("Settings.agents.noteText","Agents operate autonomously but require human approval for final bid submission.") : "Agents operate autonomously but require human approval for final bid submission."}
                    </p>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl border border-border p-6 space-y-6"
              >
                <div>
                  <h3 className="font-semibold mb-1">{t ? t("Settings.security.heading","Security Settings") : "Security Settings"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t ? t("Settings.security.description","Manage your account security") : "Manage your account security"}
                  </p>
                </div>
                <Separator />
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label>{t ? t("Settings.security.changePassword","Change Password") : "Change Password"}</Label>
                    <div className="grid gap-4">
                      <Input type="password" placeholder={t ? t("Settings.security.currentPassword","Current Password") : "Current Password"} />
                      <Input type="password" placeholder={t ? t("Settings.security.newPassword","New Password") : "New Password"} />
                      <Input type="password" placeholder={t ? t("Settings.security.confirmPassword","Confirm New Password") : "Confirm New Password"} />
                    </div>
                    <Button>{t ? t("Settings.security.updatePassword","Update Password") : "Update Password"}</Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t ? t("Settings.security.twoFA","Two-Factor Authentication") : "Two-Factor Authentication"}</p>
                      <p className="text-sm text-muted-foreground">
                        {t ? t("Settings.security.twoFADesc","Add an extra layer of security to your account") : "Add an extra layer of security to your account"}
                      </p>
                    </div>
                    <Button variant="outline">{t ? t("Settings.security.twoFA","Enable 2FA") : "Enable 2FA"}</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t ? t("Settings.security.activeSessions","Active Sessions") : "Active Sessions"}</p>
                      <p className="text-sm text-muted-foreground">
                        {t ? t("Settings.security.viewSessions","Manage your active login sessions") : "Manage your active login sessions"}
                      </p>
                    </div>
                    <Button variant="outline">{t ? t("Settings.security.viewSessions","View Sessions") : "View Sessions"}</Button>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Users Tab - Super Admin Only */}
            {isSuperAdmin && (
              <TabsContent value="users">
                <UserManagement />
              </TabsContent>
            )}
          </Tabs>
        </motion.div>
      </div>
    </MainLayout>
  );
}
