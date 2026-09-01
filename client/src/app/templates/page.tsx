"use client";

import { useState, useEffect } from "react";
import { getPatients } from "@/lib/api";
import type { Patient } from "@/lib/types";
import {
  MessageSquare,
  Mail,
  Search,
  Eye,
  Pencil,
  Plus,
  MessageCircle,
  Clock,
  Send,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Channel = "SMS" | "Email" | "WhatsApp";
type Status = "Active" | "Draft";

interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  channels: Channel[];
  status: Status;
}

const INITIAL_TEMPLATES: Template[] = [
  {
    id: "1",
    name: "Appointment Confirmation",
    description: "Sent immediately after a patient books an appointment.",
    content:
      "Dear {patient_firstname}, your appointment is confirmed. Please arrive 10 minutes early.",
    channels: ["SMS", "Email"],
    status: "Active",
  },
  {
    id: "2",
    name: "24h Reminder",
    description: "Sent 24 hours before the scheduled appointment time.",
    content:
      "Reminder: {patient_firstname}, you have an appointment tomorrow. Reply YES to confirm or CALL {clinic_phone} to reschedule.",
    channels: ["SMS", "WhatsApp"],
    status: "Active",
  },
  {
    id: "3",
    name: "Post-Visit Follow-up",
    description: "Sent 2 days after the appointment to gather feedback.",
    content:
      "Hi {patient_firstname}, thank you for visiting Rophe Specialist Care. We hope your experience was excellent. Please click here to...",
    channels: ["Email"],
    status: "Draft",
  },
  {
    id: "4",
    name: "Missed Appointment",
    description: "Sent when a patient no-shows their scheduled slot.",
    content:
      "We missed you at your appointment today, {patient_firstname}. Please contact us at {clinic_phone} to reschedule.",
    channels: ["SMS"],
    status: "Active",
  },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [patients, setPatients] = useState<Patient[]>([]);
  
  useEffect(() => {
    let active = true;
    (async () => {
      const pts = await getPatients();
      if (!active) return;
      setPatients(pts);
    })();
    return () => {
      active = false;
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<Channel | "All">("All");
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  
  // Mass Messaging States
  const [isSendModalOpen, setSendModalOpen] = useState(false);
  const [sendStep, setSendStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplateToSend, setSelectedTemplateToSend] = useState<Template | null>(null);
  
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  // Editor form state
  const [form, setForm] = useState<Partial<Template>>({});

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel =
      channelFilter === "All" || t.channels.includes(channelFilter);
    const matchesStatus = statusFilter === "All" || t.status === statusFilter;
    return matchesSearch && matchesChannel && matchesStatus;
  });

  const filteredContacts = patients.filter((p) => {
    const q = contactSearchQuery.toLowerCase();
    return p.fullName.toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q)) || p.phone.includes(q);
  });

  const openCreate = () => {
    setForm({
      name: "",
      description: "",
      content: "",
      channels: ["SMS"],
      status: "Draft",
    });
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const openEdit = (template: Template) => {
    setForm({ ...template });
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const openPreview = (template: Template) => {
    setEditingTemplate(template);
    setIsPreviewOpen(true);
  };
  
  const openSendModal = (template: Template) => {
    setSelectedTemplateToSend(template);
    setSendStep(1);
    setSelectedContacts(new Set());
    setContactSearchQuery("");
    setSendModalOpen(true);
  };

  const saveTemplate = () => {
    if (!form.name || !form.content) return;

    if (editingTemplate) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id ? ({ ...form, id: t.id } as Template) : t
        )
      );
    } else {
      const newTemplate: Template = {
        ...(form as Template),
        id: Math.random().toString(36).substring(7),
      };
      setTemplates((prev) => [...prev, newTemplate]);
    }
    setIsEditorOpen(false);
  };

  const toggleFormChannel = (ch: Channel) => {
    const curr = form.channels || [];
    if (curr.includes(ch)) {
      setForm({ ...form, channels: curr.filter((c) => c !== ch) });
    } else {
      setForm({ ...form, channels: [...curr, ch] });
    }
  };

  const insertVariable = (variable: string) => {
    setForm((prev) => ({
      ...prev,
      content: (prev.content || "") + variable,
    }));
  };
  
  const toggleContact = (id: string) => {
    const next = new Set(selectedContacts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContacts(next);
  };
  
  const toggleAllContacts = () => {
    if (selectedContacts.size === filteredContacts.length && filteredContacts.length > 0) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleSendAction = () => {
    if (sendStep === 1) {
      if (selectedContacts.size === 0) return;
      setSendStep(2);
    } else if (sendStep === 2) {
      setSendStep(3);
    }
  };

  return (
    <div className="flex h-full flex-col px-8 pt-5 pb-6 overflow-hidden bg-brand-bg">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Message Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage automated communication templates for patients.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-accent/90 transition"
        >
          <Plus className="h-4 w-4" />
          Create New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-8 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates by name or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
          />
        </div>
        
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as any)}
          className="h-10 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        >
          <option value="All">All Channels</option>
          <option value="SMS">SMS</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Email">Email</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-10 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Draft">Draft</option>
        </select>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="flex flex-col rounded-2xl bg-white p-5 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2 text-brand-accent">
                  {template.channels.includes("SMS") && <MessageSquare className="h-4 w-4" />}
                  {template.channels.includes("WhatsApp") && <MessageCircle className="h-4 w-4" />}
                  {template.channels.includes("Email") && <Mail className="h-4 w-4" />}
                </div>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide",
                    template.status === "Active"
                      ? "bg-blue-50 text-brand-accent"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {template.status}
                </span>
              </div>

              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  {template.name}
                </h3>
                <p className="text-xs text-slate-500 mb-4 h-8 overflow-hidden text-ellipsis">
                  {template.description}
                </p>

                <div className="relative mb-6 rounded-lg bg-blue-50/50 p-4 border-l-2 border-brand-accent">
                  <p className="text-xs italic text-slate-600 line-clamp-4">
                    "{template.content}"
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-auto">
                <button
                  onClick={() => openPreview(template)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
                <button
                  onClick={() => openEdit(template)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-[10px] font-semibold text-brand-accent hover:bg-slate-50 transition"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => openSendModal(template)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-transparent bg-brand-accent py-2 text-[10px] font-semibold text-white shadow-sm hover:bg-brand-accent/90 transition"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Modal */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create New Template"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Template Name</label>
              <input
                type="text"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-accent"
                placeholder="e.g. Appointment Confirmation"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <input
                type="text"
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-accent"
                placeholder="Internal description of when this is sent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Channels</label>
                <div className="flex gap-2">
                  {(["SMS", "WhatsApp", "Email"] as Channel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleFormChannel(ch)}
                      className={cn(
                        "px-2 py-1 rounded border text-xs font-medium transition-colors",
                        form.channels?.includes(ch)
                          ? "bg-brand-accent border-brand-accent text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select
                  value={form.status || "Draft"}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-accent"
                >
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between items-end">
                <label className="text-sm font-medium text-slate-700">Content</label>
              </div>
              <div className="flex flex-wrap gap-2 mb-1">
                {["{patient_firstname}", "{patient_lastname}", "{clinic_phone}"].map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => insertVariable(variable)}
                    className="px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-brand-accent hover:text-white hover:border-brand-accent transition-colors"
                  >
                    + {variable}
                  </button>
                ))}
              </div>
              <textarea
                value={form.content || ""}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full min-h-[120px] rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-accent resize-none"
                placeholder="Type your message template here..."
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsEditorOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition"
            >
              Cancel
            </button>
            <button
              onClick={saveTemplate}
              className="px-4 py-2 text-sm font-semibold text-white bg-brand-accent hover:bg-brand-accent/90 rounded-md transition"
            >
              Save Template
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Preview: {editingTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <div className="rounded-2xl bg-slate-100 p-4 shadow-inner relative">
              <div className="absolute top-0 right-4 w-0 h-0 border-l-[8px] border-l-transparent border-b-[8px] border-b-slate-100 border-r-[8px] border-r-transparent -mt-[8px]" />
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {editingTemplate?.content
                  .replace(/\{patient_firstname\}/g, "John")
                  .replace(/\{patient_lastname\}/g, "Doe")
                  .replace(/\{patient_name\}/g, "John Doe")
                  .replace(/\{clinic_phone\}/g, "020 123 4567")}
              </p>
            </div>
            <p className="text-center text-xs text-slate-400 mt-4">
              This is how the message might appear to a patient on their device.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-Step Send Message Modal */}
      <Dialog open={isSendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className={cn("p-0 overflow-hidden bg-slate-50 [&>button]:hidden", sendStep === 3 ? "sm:max-w-[360px]" : "sm:max-w-[500px]")}>
          
          {sendStep === 1 && (
            <>
              <div className="bg-white p-4 flex items-center border-b border-slate-200">
                <button onClick={() => setSendModalOpen(false)} className="text-slate-900 font-bold px-3 py-1 hover:bg-slate-100 rounded">
                  ✕
                </button>
                <h2 className="text-lg font-bold text-slate-900 flex-1 text-center pr-10">Select Contacts ({selectedContacts.size})</h2>
              </div>
              <div className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition"
                  />
                </div>
                
                <div 
                  onClick={toggleAllContacts}
                  className="flex items-center gap-4 mb-4 p-2 cursor-pointer hover:bg-slate-100 rounded-md transition"
                >
                  <input 
                    type="checkbox" 
                    checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0} 
                    readOnly
                    className="h-4 w-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent" 
                  />
                  <span className="text-sm font-medium text-slate-800">Select All Contacts</span>
                </div>

                <div className="space-y-1 h-[300px] overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-10">No contacts found.</p>
                  ) : (
                    filteredContacts.map((contact) => (
                      <div 
                        key={contact.id} 
                        onClick={() => toggleContact(contact.id)}
                        className="flex items-center gap-4 p-2 hover:bg-slate-100 rounded-md transition cursor-pointer"
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedContacts.has(contact.id)}
                          readOnly
                          className="h-4 w-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent pointer-events-none" 
                        />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900">{contact.fullName}</p>
                          <p className="text-xs text-slate-600">{contact.email ? `${contact.email} • ` : ""}{contact.phone}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="bg-white p-4 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={handleSendAction}
                  disabled={selectedContacts.size === 0}
                  className="px-6 py-2 rounded-md bg-brand-accent text-white font-semibold text-sm hover:bg-brand-accent/90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </>
          )}

          {sendStep === 2 && (
            <>
              <div className="bg-white p-4 flex items-center border-b border-slate-200">
                <button onClick={() => setSendStep(1)} className="text-slate-900 font-bold px-3 py-1 hover:bg-slate-100 rounded">
                  &lt; Back
                </button>
                <h2 className="text-lg font-bold text-slate-900 flex-1 text-center pr-14">Preview Message</h2>
              </div>
              <div className="p-6">
                <div className="rounded-2xl bg-slate-100 p-5 shadow-inner relative mb-4">
                  <div className="absolute top-0 right-4 w-0 h-0 border-l-[10px] border-l-transparent border-b-[10px] border-b-slate-100 border-r-[10px] border-r-transparent -mt-[10px]" />
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {selectedTemplateToSend?.content
                      .replace(/\{patient_firstname\}/g, "John")
                      .replace(/\{patient_lastname\}/g, "Doe")
                      .replace(/\{patient_name\}/g, "John Doe")
                      .replace(/\{clinic_phone\}/g, "020 123 4567")}
                  </p>
                </div>
                <div className="bg-brand-accent/10 border border-brand-accent/20 rounded-md p-3">
                  <p className="text-xs font-semibold text-brand-accent text-center">
                    This message will be sent to {selectedContacts.size} patient(s).
                  </p>
                </div>
              </div>
              <div className="bg-white p-4 border-t border-slate-200 flex justify-between">
                <button 
                  onClick={() => setSendModalOpen(false)}
                  className="px-4 py-2 rounded-md text-slate-600 font-semibold text-sm hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSendAction}
                  className="px-6 py-2 rounded-md bg-brand-accent text-white font-semibold text-sm hover:bg-brand-accent/90 transition shadow-sm"
                >
                  Proceed to Send
                </button>
              </div>
            </>
          )}

          {sendStep === 3 && (
            <div className="p-8 text-center bg-white flex flex-col items-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Message Sent!</h2>
              <p className="text-sm text-slate-500 mb-8">
                Your template "{selectedTemplateToSend?.name}" was successfully sent to {selectedContacts.size} patient(s).
              </p>
              <button 
                onClick={() => setSendModalOpen(false)}
                className="w-full px-6 py-2.5 rounded-md bg-brand-accent text-white font-bold text-sm hover:bg-brand-accent/90 transition shadow-sm"
              >
                Done
              </button>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}
