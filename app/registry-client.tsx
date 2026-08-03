"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import EvidenceWorkspace from "./evidence-workspace";
import AnalyticsWorkspace from "./analytics-workspace";
import LedgerWorkspace from "./ledger-workspace";
import StakeholderDashboard from "./stakeholder-dashboard";
import PublicRegistry from "./public-registry";
import ReadinessWorkspace from "./readiness-workspace";
import MarketplaceWorkspace from "./marketplace-workspace";

const MapEditor = dynamic(() => import("./map-editor"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading boundary map…</div>,
});

type User = { displayName: string; email: string } | null;
type Profile = {
  email: string;
  full_name: string;
  role: Role;
  organization?: string;
  registration_number?: string;
  organization_type?: string;
  website?: string;
  contact_phone?: string;
  verification_status: string;
};

type TimelineEvent = {
  id: string;
  status: Status;
  note?: string;
  createdAt: string;
  user: {
    fullName: string;
    role: string;
  };
};

type Project = {
  id: string;
  name: string;
  ecosystem: "mangrove" | "seagrass" | "salt_marsh";
  state: string;
  district: string;
  village: string;
  start_date: string;
  duration_years: number;
  responsible_organization: string;
  community_partner: string;
  boundary_geojson: string;
  area_hectares: number;
  status: Status;
  reviewer_note?: string;
  submitted_at: string;
  documents?: Array<{
    id: string;
    project_id: string;
    category: "LAND_AUTHORIZATION" | "RESTORATION_PLAN" | "BASELINE_EVIDENCE";
    file_name: string;
    content_type: string;
    size_bytes: number;
    uploaded_at: string;
  }>;
  timeline?: TimelineEvent[];
};

type Role = "ngo" | "community" | "admin" | "verifier" | "buyer";
type Status =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED";

type View = "overview" | "register" | "projects" | "evidence" | "analytics" | "ledger" | "public" | "readiness" | "review" | "profile" | "marketplace";

const roleLabels: Record<Role, string> = {
  ngo: "NGO / Project developer",
  community: "Coastal community representative",
  admin: "Administrator",
  verifier: "Technical verifier",
  buyer: "Buyer / Observer",
};
const statusLabels: Record<Status, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved for MRV",
  REJECTED: "Rejected",
};
const statusClass: Record<Status, string> = {
  DRAFT: "slate",
  SUBMITTED: "slate",
  UNDER_REVIEW: "amber",
  CHANGES_REQUESTED: "orange",
  APPROVED: "green",
  REJECTED: "red",
};

const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "register", label: "Register project", icon: "＋" },
  { id: "projects", label: "Project registry", icon: "▤" },
  { id: "evidence", label: "Evidence ledger", icon: "#" },
  { id: "analytics", label: "MRV analytics", icon: "⌁" },
  { id: "marketplace", label: "Marketplace", icon: "🛒" },
  { id: "ledger", label: "BlueLedger", icon: "◆" },
  { id: "public", label: "Public registry", icon: "◉" },
  { id: "readiness", label: "SIH judge mode", icon: "▶" },
  { id: "review", label: "Review queue", icon: "✓" },
  { id: "profile", label: "Organization profile", icon: "◎" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ecosystemLabel(value: Project["ecosystem"]) {
  return value === "salt_marsh"
    ? "Salt marsh"
    : value.charAt(0).toUpperCase() + value.slice(1);
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill ${statusClass[status]}`}><i />{statusLabels[status]}</span>;
}

export default function RegistryClient({ initialUser }: { initialUser: User }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [identity, setIdentity] = useState<User>(initialUser);
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const signOutAndRedirect = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (_) {
      // best-effort
    }
    window.location.href = "/login";
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/registry", { cache: "no-store" });
    if (!response.ok) {
      // 401 = stale/missing session — clear cookie then go to login
      if (response.status === 401) {
        await signOutAndRedirect();
        return;
      }
      setLoading(false);
      return;
    }
    const data = await response.json();
    
    const profileData = data.profile ? {
      ...data.profile,
      role: data.profile.role.toLowerCase() as Role,
    } : null;

    setProfile(profileData);
    setProjects(data.projects ?? []);
    setIdentity((current) => current ?? {
      displayName: data.identity.name,
      email: data.identity.email,
    });
    setLoading(false);
  }, [signOutAndRedirect]);


  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts = useMemo(() => ({
    active: projects.filter((project) => project.status !== "REJECTED").length,
    review: projects.filter((project) => ["SUBMITTED", "UNDER_REVIEW"].includes(project.status)).length,
    approved: projects.filter((project) => project.status === "APPROVED").length,
    hectares: projects.reduce((sum, project) => sum + Number(project.area_hectares), 0),
  }), [projects]);

  const navigate = (next: View) => {
    if (next !== "register") {
      setEditingProject(null);
    }
    setView(next);
    setMenuOpen(false);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setView("register");
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="brand-mark">BC</div>
        <h1>BlueRegistry</h1>
        <p>Preparing your coastal restoration workspace…</p>
        <div className="loading-line"><span /></div>
      </div>
    );
  }

  if (!profile) {
    // Still loading profile data — keep showing the spinner
    return (
      <div className="loading-screen">
        <div className="brand-mark">BC</div>
        <h1>BlueRegistry</h1>
        <p>Loading your workspace…</p>
        <div className="loading-line"><span /></div>
      </div>
    );
  }

  const isAdmin = profile.role === "admin";
  const canRegister = ["ngo", "community"].includes(profile.role);
  const visibleNav = navItems.filter((item) => {
    if (item.id === "review") return isAdmin;
    if (item.id === "register") return canRegister;
    return true;
  });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">BC</div>
          <div><strong>BlueRegistry</strong><span>Coastal project gateway</span></div>
        </div>
        <nav aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.id === "review" && counts.review > 0 && <b>{counts.review}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="shield">✓</span>
          <div><strong>Evidence-led registry</strong><p>Authorization is reviewed by qualified administrators.</p></div>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{(profile.full_name || "U").slice(0, 2).toUpperCase()}</div>
          <div><strong>{profile.full_name}</strong><span>{roleLabels[profile.role]}</span></div>
          <button aria-label="Open profile" onClick={() => navigate("profile")}>⋯</button>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen((open) => !open)}>☰</button>
          <div className="breadcrumb"><span>BlueRegistry</span><b>/</b>{navItems.find((item) => item.id === view)?.label}</div>
          <div className="top-actions">
            <span className="secure-indicator"><i /> Private workspace</span>
            <button 
              className="help-button text-xs bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 font-semibold px-3 py-1 rounded transition-colors mr-2 cursor-pointer"
              onClick={handleLogout}
            >
              Log Out
            </button>
            <button className="help-button">?</button>
          </div>
        </header>
        <main className="main-content">
          {notice && <div className="notice"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}
          {view === "overview" && (
            <StakeholderDashboard
              role={profile.role}
              onRoleChanged={refresh}
              onNavigate={navigate}
            />
          )}
          {view === "register" && (
            <RegisterProject
              profile={profile}
              project={editingProject}
              onComplete={async (msg) => {
                await refresh();
                setEditingProject(null);
                setNotice(msg || "Project draft saved successfully.");
                setView("projects");
              }}
            />
          )}
          {view === "projects" && (
            <ProjectRegistry 
              projects={projects} 
              onEdit={handleEditProject} 
              canRegister={canRegister}
              onNavigate={navigate}
            />
          )}
          {view === "evidence" && <EvidenceWorkspace role={profile.role} />}
          {view === "analytics" && <AnalyticsWorkspace />}
          {view === "marketplace" && <MarketplaceWorkspace role={profile.role} />}
          {view === "ledger" && <LedgerWorkspace role={profile.role} />}
          {view === "public" && <PublicRegistry />}
          {view === "readiness" && <ReadinessWorkspace />}
          {view === "review" && isAdmin && (
            <ReviewQueue projects={projects} onUpdated={refresh} />
          )}
          {view === "profile" && (
            <ProfileView profile={profile} identity={identity} onUpdated={refresh} />
          )}
        </main>
      </div>
    </div>
  );
}

function RegisterProject({ 
  profile, 
  project, 
  onComplete 
}: { 
  profile: Profile; 
  project: Project | null; 
  onComplete: (msg: string) => Promise<void> 
}) {
  const [step, setStep] = useState(1);
  const [boundary, setBoundary] = useState({ geojson: "", area: 0, points: [] as [number, number][] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({
    responsibleOrganization: profile.organization ?? "",
    durationYears: "10",
  });
  const [files, setFiles] = useState<Record<string, File | null>>({
    land_authorization: null,
    restoration_plan: null,
    baseline_evidence: null,
  });

  // Initialize values if editing an existing project draft
  useEffect(() => {
    if (project) {
      setFormValues({
        name: project.name,
        ecosystem: project.ecosystem,
        state: project.state,
        district: project.district,
        village: project.village,
        startDate: project.start_date,
        durationYears: String(project.duration_years),
        responsibleOrganization: project.responsible_organization,
        communityPartner: project.community_partner,
      });
      
      let points: [number, number][] = [];
      try {
        const parsed = JSON.parse(project.boundary_geojson);
        if (parsed.geometry?.coordinates?.[0]) {
          points = parsed.geometry.coordinates[0];
        }
      } catch {}
      
      setBoundary({
        geojson: project.boundary_geojson,
        area: project.area_hectares,
        points,
      });
    }
  }, [project]);

  // Must be defined unconditionally — used in step 2 MapEditor (Rules of Hooks)
  const onBoundaryChange = useCallback(
    (geojson: string, area: number, points: [number, number][]) =>
      setBoundary({ geojson, area, points }),
    []
  );

  const updateValue = (name: string, value: string) => setFormValues((current) => ({ ...current, [name]: value }));
  
  const validStep = step === 1
    ? ["name", "ecosystem", "state", "district", "village", "startDate", "durationYears", "responsibleOrganization", "communityPartner"].every((key) => formValues[key]?.trim())
    : step === 2
      ? boundary.points.length >= 3 && boundary.area > 0
      : true; // Step 3 docs are validated at submission / draft save

  const uploadDocuments = async (projectId: string) => {
    for (const [category, file] of Object.entries(files)) {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", category.toUpperCase()); // Enums are uppercase
        const res = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(`Failed to upload ${category}: ${errData.error || res.statusText}`);
        }
      }
    }
  };

  async function handleSaveDraft() {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: formValues.name,
        ecosystem: formValues.ecosystem,
        state: formValues.state,
        district: formValues.district,
        village: formValues.village,
        startDate: formValues.startDate,
        durationYears: Number(formValues.durationYears),
        responsibleOrganization: formValues.responsibleOrganization,
        communityPartner: formValues.communityPartner,
        boundaryGeojson: boundary.geojson,
        areaHectares: boundary.area,
      };

      let projectId = project?.id;
      if (projectId) {
        // Update existing draft
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to update project draft.");
        }
      } else {
        // Create new draft
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to create project draft.");
        }
        const data = await res.json();
        projectId = data.project.id;
      }

      if (!projectId) throw new Error("Project ID is missing.");
      await uploadDocuments(projectId);
      await onComplete("Project draft saved successfully.");
    } catch (err: any) {
      setError(err.message || "An error occurred while saving draft.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: formValues.name,
        ecosystem: formValues.ecosystem,
        state: formValues.state,
        district: formValues.district,
        village: formValues.village,
        startDate: formValues.startDate,
        durationYears: Number(formValues.durationYears),
        responsibleOrganization: formValues.responsibleOrganization,
        communityPartner: formValues.communityPartner,
        boundaryGeojson: boundary.geojson,
        areaHectares: boundary.area,
      };

      let projectId = project?.id;
      if (projectId) {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to save project updates.");
        }
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to register project.");
        }
        const data = await res.json();
        projectId = data.project.id;
      }

      if (!projectId) throw new Error("Project ID is missing.");
      await uploadDocuments(projectId);

      // Perform submission
      const subRes = await fetch(`/api/projects/${projectId}/submit`, {
        method: "POST",
      });
      if (!subRes.ok) {
        const errData = await subRes.json();
        throw new Error(errData.error || "Failed to submit project.");
      }

      await onComplete("Project submitted successfully. Awaiting administrator review.");
    } catch (err: any) {
      setError(err.message || "An error occurred during submission.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="eyebrow">New registry entry</span>
          <h1>{project ? "Edit project record" : "Register a restoration project"}</h1>
          <p>Create a structured record for review and MRV readiness.</p>
        </div>
        <span className="draft-badge">{project ? `Status: ${project.status}` : "Draft Mode"}</span>
      </section>
      <div className="stepper">
        {["Project details", "Map boundary", "Evidence", "Review & submit"].map((label, index) => (
          <div className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} key={label}>
            <span>{step > index + 1 ? "✓" : index + 1}</span><b>{label}</b>
          </div>
        ))}
      </div>
      <section className="form-card">
        {step === 1 && (
          <div className="form-section">
            <div className="section-heading"><span>01</span><div><h2>Project details</h2><p>Tell us where the work is happening and who is responsible.</p></div></div>
            <div className="field-grid">
              <label className="wide">Project name<input value={formValues.name ?? ""} onChange={(e) => updateValue("name", e.target.value)} placeholder="e.g. Gosaba Community Mangrove Restoration" /></label>
              <label className="wide">Ecosystem type
                <div className="ecosystem-options">
                  {[
                    ["mangrove", "♧", "Mangrove"],
                    ["seagrass", "≋", "Seagrass"],
                    ["salt_marsh", "⌁", "Salt marsh"],
                  ].map(([value, icon, label]) => (
                    <button type="button" key={value} className={formValues.ecosystem === value ? "selected" : ""} onClick={() => updateValue("ecosystem", value)}>
                      <span>{icon}</span><b>{label}</b><small>{value === "mangrove" ? "Intertidal forests" : value === "seagrass" ? "Submerged meadows" : "Coastal wetlands"}</small>
                    </button>
                  ))}
                </div>
              </label>
              <label>State<input value={formValues.state ?? ""} onChange={(e) => updateValue("state", e.target.value)} placeholder="e.g. West Bengal" /></label>
              <label>District<input value={formValues.district ?? ""} onChange={(e) => updateValue("district", e.target.value)} placeholder="e.g. South 24 Parganas" /></label>
              <label>Village / local area<input value={formValues.village ?? ""} onChange={(e) => updateValue("village", e.target.value)} placeholder="e.g. Gosaba" /></label>
              <label>Restoration start date<input type="date" value={formValues.startDate ?? ""} onChange={(e) => updateValue("startDate", e.target.value)} /></label>
              <label>Expected duration (years)<input type="number" min="1" max="100" value={formValues.durationYears ?? ""} onChange={(e) => updateValue("durationYears", e.target.value)} /></label>
              <label>Responsible organization<input value={formValues.responsibleOrganization ?? ""} onChange={(e) => updateValue("responsibleOrganization", e.target.value)} placeholder="Lead organization" /></label>
              <label className="wide">Community partner<input value={formValues.communityPartner ?? ""} onChange={(e) => updateValue("communityPartner", e.target.value)} placeholder="Local council, cooperative or community institution" /></label>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="form-section">
            <div className="section-heading"><span>02</span><div><h2>Map the project boundary</h2><p>Draw the restoration area. We’ll calculate its approximate size and store the boundary as GeoJSON.</p></div></div>
            <MapEditor onChange={onBoundaryChange} />
            {boundary.points.length >= 3 && (
              <details className="coordinate-panel">
                <summary>View captured coordinates <span>{boundary.points.length} points</span></summary>
                <pre>{boundary.points.map(([lng, lat], index) => `${index + 1}. ${lat.toFixed(6)}, ${lng.toFixed(6)}`).join("\n")}</pre>
              </details>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="form-section">
            <div className="section-heading"><span>03</span><div><h2>Upload authorization and baseline evidence</h2><p>Each document category supports verification. PDF, JPG or PNG up to 15 MB.</p></div></div>
            <div className="upload-stack">
              <UploadField icon="⌂" title="Land authorization / lease / community consent" description="Evidence that restoration activities are authorized by rights-holders." file={files.land_authorization} onFile={(file) => setFiles((current) => ({ ...current, land_authorization: file }))} />
              <UploadField icon="♧" title="Restoration plan" description="Objectives, species, timeline, and stewardship approach." file={files.restoration_plan} onFile={(file) => setFiles((current) => ({ ...current, restoration_plan: file }))} />
              <UploadField icon="▤" title="Baseline evidence" description="Photographs, maps, or ecological baseline surveys." file={files.baseline_evidence} onFile={(file) => setFiles((current) => ({ ...current, baseline_evidence: file }))} />
            </div>
            <div className="warning-card"><span>!</span><div><strong>Authorization evidence is reviewed, not legally certified</strong><p>Registry approval verifies MRV configuration readiness, not land ownership title.</p></div></div>
          </div>
        )}
        {step === 4 && (
          <div className="form-section">
            <div className="section-heading"><span>04</span><div><h2>Review and submit</h2><p>Confirm the project details before submitting or saving.</p></div></div>
            <div className="review-grid">
              <ReviewBlock title="Project"><dl><dt>Name</dt><dd>{formValues.name}</dd><dt>Ecosystem</dt><dd>{formValues.ecosystem && ecosystemLabel(formValues.ecosystem as Project["ecosystem"])}</dd><dt>Location</dt><dd>{formValues.village}, {formValues.district}, {formValues.state}</dd></dl><button onClick={() => setStep(1)}>Edit</button></ReviewBlock>
              <ReviewBlock title="Boundary"><dl><dt>Area</dt><dd>{boundary.area.toFixed(2)} hectares</dd><dt>Coordinates</dt><dd>{boundary.points.length} boundary points</dd><dt>Format</dt><dd>GeoJSON Polygon</dd></dl><button onClick={() => setStep(2)}>Edit</button></ReviewBlock>
              <ReviewBlock title="Evidence"><dl>{Object.entries(files).map(([key, file]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{file ? file.name : (project?.documents?.find(d => d.category === key.toUpperCase()) ? "✓ Retained from previous upload" : "Not uploaded")}</dd></div>)}</dl><button onClick={() => setStep(3)}>Edit</button></ReviewBlock>
            </div>
            <label className="consent-check"><input type="checkbox" required /><span>I confirm this record is accurate to the best of my knowledge.</span></label>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <footer className="form-footer">
          <button className="secondary-button" disabled={step === 1 || submitting} onClick={() => setStep((current) => current - 1)}>← Back</button>
          <div className="flex gap-2">
            <button className="secondary-button text-xs" disabled={submitting} onClick={handleSaveDraft}>Save draft</button>
            <span>Step {step} of 4</span>
          </div>
          {step < 4 ? (
            <button className="primary-button" disabled={!validStep} onClick={() => setStep((current) => current + 1)}>Continue <span>→</span></button>
          ) : (
            <button className="primary-button" disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit for review"} <span>→</span></button>
          )}
        </footer>
      </section>
    </>
  );
}

function UploadField({ icon, title, description, file, onFile }: { icon: string; title: string; description: string; file: File | null; onFile: (file: File | null) => void }) {
  return (
    <label className={`upload-field ${file ? "has-file" : ""}`}>
      <span className="upload-icon">{file ? "✓" : icon}</span>
      <div><strong>{title}</strong><p>{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : description}</p></div>
      <span className="upload-action">{file ? "Replace" : "Choose file"}</span>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
    </label>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="review-block"><h3>{title}</h3>{children}</article>;
}

function ProjectRegistry({ 
  projects, 
  onEdit, 
  canRegister,
  onNavigate 
}: { 
  projects: Project[]; 
  onEdit: (p: Project) => void; 
  canRegister: boolean;
  onNavigate: (view: View) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedDetails, setSelectedDetails] = useState<Project | null>(null);

  const filtered = projects.filter((project) =>
    (filter === "all" || project.status === filter) &&
    `${project.name} ${project.state} ${project.district} ${project.village}`.toLowerCase().includes(query.toLowerCase()),
  );

  const handleOpenDetails = async (project: Project) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDetails(data.project);
      } else {
        setSelectedDetails(project);
      }
    } catch {
      setSelectedDetails(project);
    }
  };

  return (
    <>
      <section className="page-heading">
        <div><span className="eyebrow">Registry</span><h1>Project records</h1><p>Trace every project from initial submission to MRV approval.</p></div>
        {canRegister && <button className="primary-button" onClick={() => onNavigate("register")}>＋ Register new project</button>}
      </section>
      <section className="panel registry-panel">
        <div className="registry-tools">
          <label className="search-box"><span>⌕</span><input placeholder="Search projects or locations" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Project</th><th>Ecosystem</th><th>Location</th><th>Area</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((project) => (
                <tr key={project.id}>
                  <td><strong>{project.name}</strong><small>#{project.id.slice(0, 8).toUpperCase()}</small></td>
                  <td>{ecosystemLabel(project.ecosystem)}</td>
                  <td>{project.village}, {project.state}</td>
                  <td>{Number(project.area_hectares).toFixed(2)} ha</td>
                  <td>{formatDate(project.submitted_at)}</td>
                  <td><StatusPill status={project.status} /></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="text-button text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300" onClick={() => handleOpenDetails(project)}>Details</button>
                      {(project.status === "DRAFT" || project.status === "CHANGES_REQUESTED") && (
                        <button className="text-button text-xs px-2 py-1 bg-blue-900/60 hover:bg-blue-800/80 rounded text-blue-200" onClick={() => onEdit(project)}>Edit</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="empty-table">No matching project records.</div>}
        </div>
      </section>

      {selectedDetails && (
        <div className="details-modal-overlay" onClick={() => setSelectedDetails(null)}>
          <div className="details-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{selectedDetails.name}</h2>
              <button className="close-btn" onClick={() => setSelectedDetails(null)}>×</button>
            </header>
            <div className="modal-body">
              <section className="mb-4"><span className="eyebrow">Status</span><div><StatusPill status={selectedDetails.status} /></div></section>
              <section className="mb-4">
                <span className="eyebrow">Details</span>
                <dl className="grid grid-cols-2 gap-2 text-sm text-slate-300 mt-1">
                  <div><dt className="text-slate-500 text-xs">Ecosystem</dt><dd>{ecosystemLabel(selectedDetails.ecosystem)}</dd></div>
                  <div><dt className="text-slate-500 text-xs">Area</dt><dd>{Number(selectedDetails.area_hectares).toFixed(2)} ha</dd></div>
                  <div><dt className="text-slate-500 text-xs">State / Village</dt><dd>{selectedDetails.village}, {selectedDetails.state}</dd></div>
                  <div><dt className="text-slate-500 text-xs">Responsible Org</dt><dd>{selectedDetails.responsible_organization}</dd></div>
                </dl>
              </section>

              <section className="mb-4">
                <span className="eyebrow">Documents</span>
                <div className="mt-2 flex flex-col gap-2">
                  {selectedDetails.documents && selectedDetails.documents.length > 0 ? (
                    selectedDetails.documents.map((doc) => (
                      <div key={doc.id} className="flex justify-between items-center text-xs p-2 bg-slate-800/50 rounded border border-slate-700/50">
                        <span><strong>{doc.category.replaceAll("_", " ")}</strong>: {doc.file_name}</span>
                        <a href={`/api/projects/${selectedDetails.id}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">View ↗</a>
                      </div>
                    ))
                  ) : <p className="text-slate-500 text-xs mt-1">No documents uploaded.</p>}
                </div>
              </section>

              <section>
                <span className="eyebrow">Review Timeline</span>
                <div className="timeline-trail mt-2">
                  {selectedDetails.timeline && selectedDetails.timeline.length > 0 ? (
                    selectedDetails.timeline.map((event) => (
                      <div key={event.id} className="timeline-node">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className={`text-slate-400`}>{event.user.fullName} ({event.user.role})</span>
                          <span className="text-slate-500">{new Date(event.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1">Transitioned to <span className="font-bold">{statusLabels[event.status]}</span></div>
                        {event.note && <p className="italic text-slate-400 text-xs mt-1 bg-slate-800 p-2 rounded">Note: "{event.note}"</p>}
                      </div>
                    ))
                  ) : <p className="text-slate-500 text-xs mt-1">No timeline entries recorded.</p>}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ReviewQueue({ projects, onUpdated }: { projects: Project[]; onUpdated: () => Promise<void> }) {
  const queue = projects.filter((project) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(project.status));
  const [selected, setSelected] = useState<Project | null>(queue[0] ?? null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Automatically start review state when opening a submitted project
  useEffect(() => {
    if (selected && selected.status === "SUBMITTED") {
      fetch(`/api/projects/${selected.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START" }),
      }).then(() => {
        onUpdated();
      });
    }
  }, [selected, onUpdated]);

  async function decide(action: "APPROVE" | "REJECT" | "REQUEST_CHANGES") {
    if (!selected) return;
    setSaving(true);
    const response = await fetch(`/api/projects/${selected.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (response.ok) {
      await onUpdated();
      setSelected(null);
      setNote("");
    } else {
      const err = await response.json();
      alert(`Review action failed: ${err.error}`);
    }
    setSaving(false);
  }

  return (
    <>
      <section className="page-heading"><div><span className="eyebrow">Qualified review</span><h1>Document review queue</h1><p>Assess submitted records and decide whether they are ready to enter MRV.</p></div><span className="queue-count">{queue.length} awaiting action</span></section>
      <section className="review-layout">
        <div className="panel queue-list">
          {queue.length ? queue.map((project) => (
            <button key={project.id} className={selected?.id === project.id ? "selected" : ""} onClick={() => setSelected(project)}>
              <span className={`eco-icon ${project.ecosystem}`}>{project.ecosystem === "mangrove" ? "♧" : "≋"}</span>
              <span><strong>{project.name}</strong><small>{project.village}, {project.state} · {formatDate(project.submitted_at)}</small></span>
              <StatusPill status={project.status} />
            </button>
          )) : <div className="empty-state"><span>✓</span><h3>Queue is clear</h3><p>No projects need review.</p></div>}
        </div>
        <div className="panel decision-panel">
          {selected ? (
            <>
              <span className="eyebrow">Review record</span><h2>{selected.name}</h2>
              <div className="review-summary"><dl><dt>Ecosystem</dt><dd>{ecosystemLabel(selected.ecosystem)}</dd><dt>Area</dt><dd>{Number(selected.area_hectares).toFixed(2)} ha</dd><dt>Location</dt><dd>{selected.village}, {selected.district}, {selected.state}</dd><dt>Community partner</dt><dd>{selected.community_partner}</dd><dt>Current status</dt><dd><StatusPill status={selected.status} /></dd></dl></div>
              <div className="document-checks">
                {[
                  ["LAND_AUTHORIZATION", "Land authorization evidence"],
                  ["RESTORATION_PLAN", "Restoration plan"],
                  ["BASELINE_EVIDENCE", "Baseline evidence"],
                ].map(([category, label]) => {
                  const document = selected.documents?.find((item) => item.category === category);
                  return (
                    <div key={category}>
                      <i>{document ? "✓" : "!"}</i>
                      <span><strong>{label}</strong><small>{document?.file_name ?? "Document missing"}</small></span>
                      {document && <a href={`/api/projects/${selected.id}/documents/${document.id}`} target="_blank" rel="noreferrer">Review</a>}
                    </div>
                  );
                })}
              </div>
              <label>Reviewer note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record the basis for your decision, especially for changes or rejection." /></label>
              <div className="decision-actions">
                <button disabled={saving} className="secondary-button" onClick={() => decide("REQUEST_CHANGES")}>Request changes</button>
                <button disabled={saving} className="reject-button" onClick={() => decide("REJECT")}>Reject</button>
                <button disabled={saving} className="primary-button" onClick={() => decide("APPROVE")}>Approve for MRV</button>
              </div>
              <p className="decision-footnote"><b>Important:</b> This decision confirms registry readiness based on submitted evidence. It does not certify legal title or land ownership.</p>
            </>
          ) : <div className="empty-state"><span>←</span><h3>Select a project</h3><p>Choose a record from the queue to begin review.</p></div>}
        </div>
      </section>
    </>
  );
}

function ProfileView({ profile, identity, onUpdated }: { profile: Profile; identity: User; onUpdated: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const body = new FormData(event.currentTarget);
    body.set("action", "save_profile");
    body.set("role", profile.role);
    await fetch("/api/registry", { method: "POST", body });
    await onUpdated();
    setSaving(false);
  }
  return (
    <>
      <section className="page-heading"><div><span className="eyebrow">Identity & organization</span><h1>Organization profile</h1><p>Keep registry contact and verification information current.</p></div><span className={`verification-badge ${profile.verification_status}`}>{profile.verification_status === "verified" ? "✓ Verified organization" : "○ Verification not completed"}</span></section>
      <form className="panel profile-card" onSubmit={submit}>
        <div className="profile-hero"><div className="avatar large">{profile.full_name.slice(0, 2).toUpperCase()}</div><div><h2>{profile.organization || profile.full_name}</h2><p>{roleLabels[profile.role]} · {identity?.email}</p></div></div>
        <div className="field-grid">
          <label>Full name<input name="fullName" defaultValue={profile.full_name} /></label>
          <label>Organization / community<input name="organization" defaultValue={profile.organization} /></label>
          <label>Organization type<input name="organizationType" defaultValue={profile.organization_type} /></label>
          <label>Registration number<input name="registrationNumber" defaultValue={profile.registration_number} /></label>
          <label>Website<input name="website" type="url" defaultValue={profile.website} /></label>
          <label>Contact number<input name="contactPhone" defaultValue={profile.contact_phone} /></label>
        </div>
        <div className="profile-footer"><p>Changes to verification fields may require administrator review.</p><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
      </form>
    </>
  );
}
