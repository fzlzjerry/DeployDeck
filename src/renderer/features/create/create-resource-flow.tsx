import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, FolderOpen, GitBranch, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  CreateResourceKind,
  GitProjectSource,
  LocalSourceHandle,
  OperationProgress,
  ProjectCreateInput,
  Provider,
  UnifiedProject,
  WorkerScript,
} from "@shared/models";
import { Button, CheckboxControl, Input, Label, SegmentedControl, SelectControl } from "@/components/ui/primitives";
import { useConnection, usePrefs } from "@/hooks/use-connection";
import { useProjects } from "@/hooks/use-data";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";

type SourceMode = "git" | "local";
type GitProvider = GitProjectSource["provider"];
type WorkerLocalKind = "worker-entry" | "worker-project" | "worker-bundle";

interface DraftEnvironmentVariable {
  id: string;
  key: string;
  value: string;
  secret: boolean;
  target: "production" | "preview" | "development";
  branch: string;
}

const GIT_PROVIDERS = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "bitbucket", label: "Bitbucket" },
] as const;

const SOURCE_OPTIONS = [
  { value: "git", label: "Git repository", icon: GitBranch },
  { value: "local", label: "Local upload", icon: FolderOpen },
] as const;

const WORKER_LOCAL_OPTIONS = [
  { value: "worker-entry", label: "Entry file" },
  { value: "worker-project", label: "Project folder" },
  { value: "worker-bundle", label: "Prebuilt bundle" },
] as const;

const STEP_LABELS = ["Resource", "Source & build", "Environment", "Review"];

export function CreateResourceFlow({ kind }: { kind: CreateResourceKind }) {
  const close = useUiStore((state) => state.closeCreate);
  const setScreen = useUiStore((state) => state.setScreen);
  const openProject = useUiStore((state) => state.openProject);
  const connection = useConnection();
  const prefs = usePrefs();
  const projects = useProjects();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [sourceMode, setSourceMode] = useState<SourceMode>("git");
  const [gitProvider, setGitProvider] = useState<GitProvider>("github");
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("main");
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState(connection.data?.cloudflare.activeAccountId ?? "");
  const [projectKey, setProjectKey] = useState("");
  const [framework, setFramework] = useState("");
  const [rootDirectory, setRootDirectory] = useState("");
  const [installCommand, setInstallCommand] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [outputDirectory, setOutputDirectory] = useState("");
  const [workerLocalKind, setWorkerLocalKind] = useState<WorkerLocalKind>("worker-entry");
  const [source, setSource] = useState<LocalSourceHandle | null>(null);
  const [environmentVariables, setEnvironmentVariables] = useState<DraftEnvironmentVariable[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<OperationProgress>();

  const allProjects = useMemo(
    () => [
      ...(projects.data?.vercel ?? []),
      ...(projects.data?.pages ?? []),
      ...(projects.data?.workers ?? []).map(workerAsProject),
    ],
    [projects.data],
  );
  const selectedProject = allProjects.find((project) => `${project.provider}:${project.accountId}:${project.id}` === projectKey);
  const provider = providerForKind(kind, selectedProject);
  const providerWritable = provider === "vercel"
    ? Boolean(connection.data?.vercel.connected)
    : provider === "cloudflare-pages"
      ? Boolean(connection.data?.cloudflare.capabilities?.pagesWrite)
      : Boolean(connection.data?.cloudflare.capabilities?.workersWrite);
  const accountOptions = (connection.data?.cloudflare.accounts ?? []).map((account) => ({ value: account.id, label: account.name }));
  const projectOptions = allProjects.map((project) => ({
    value: `${project.provider}:${project.accountId}:${project.id}`,
    label: `${project.name} · ${providerLabel(project.provider)}`,
  }));
  const title = flowTitle(kind);

  useEffect(() => {
    return window.deployDeck.on<OperationProgress>("host:operation-progress", (next) => setProgress(next));
  }, []);

  useEffect(() => {
    return () => {
      if (source) void window.deployDeck.files.releaseLocalSource(source.id);
    };
  }, [source]);

  const chooseLocal = async () => {
    const handle = await window.deployDeck.files.selectLocalSource(sourceKind(provider, workerLocalKind));
    if (!handle) return;
    setSource(handle);
    setRepository(handle.detected?.repository ?? repository);
    setFramework(handle.detected?.framework ?? framework);
    setOutputDirectory(handle.detected?.outputDirectory ?? outputDirectory);
    if (!name) setName(cleanName(handle.name));
  };

  const canAdvance = step === 0
    ? kind === "deployment" ? Boolean(projectKey && providerWritable) : Boolean(name.trim() && providerWritable && (provider === "vercel" || accountId))
    : step === 1
      ? sourceMode === "git"
        ? Boolean(repository.trim() && branch.trim() && (provider !== "cloudflare-workers" || connection.data?.cloudflare.capabilities?.workerBuilds))
        : Boolean(source && source.fileCount > 0 && source.warnings.every((warning) => !warning.includes("exceeds")))
      : true;

  const submit = async () => {
    if (!canAdvance || saving) return;
    setSaving(true);
    let createdProject: UnifiedProject | undefined;
    try {
      const sourceInput = sourceMode === "git"
        ? { kind: "git" as const, provider: gitProvider, repository: repository.trim(), branch: branch.trim() }
        : { kind: provider === "cloudflare-pages" ? "direct" as const : "local" as const, sourceId: source!.id };
      if (kind === "deployment") {
        if (!selectedProject) throw new Error("Choose a project to deploy.");
        await deployExisting(selectedProject, sourceInput);
        setScreen("deployments");
      } else if (kind === "vercel-project" || kind === "pages-project" || kind === "worker") {
        const input: ProjectCreateInput = {
          provider,
          accountId: provider === "vercel" ? undefined : accountId,
          name: name.trim(),
          source: sourceInput,
          productionBranch: branch.trim() || "main",
          framework: framework || undefined,
          rootDirectory: rootDirectory || undefined,
          installCommand: installCommand || undefined,
          buildCommand: buildCommand || undefined,
          outputDirectory: outputDirectory || undefined,
          compatibilityDate: provider === "cloudflare-workers" ? new Date().toISOString().slice(0, 10) : undefined,
        };
        if (provider === "vercel") {
          const created = await window.deployDeck.vercel.createProject(input);
          createdProject = created;
          await applyEnvironmentVariables(created);
          await window.deployDeck.vercel.createDeployment({
            projectId: created.id,
            source: sourceInput,
            target: prefs.data?.defaultDeploymentTarget ?? "preview",
          });
        } else if (provider === "cloudflare-pages") {
          const created = await window.deployDeck.cloudflare.createPagesProject(input);
          createdProject = created;
          await applyEnvironmentVariables(created);
          await window.deployDeck.cloudflare.createPagesDeployment({
            projectId: created.id,
            accountId,
            projectName: created.name,
            source: sourceInput,
            target: prefs.data?.defaultDeploymentTarget ?? "preview",
          });
        } else {
          const worker = await window.deployDeck.cloudflare.createWorker(input);
          const created = workerAsProject(worker);
          createdProject = created;
          await applyEnvironmentVariables(created);
          if (sourceInput.kind === "git") {
            await window.deployDeck.cloudflare.triggerWorkerBuild(accountId, worker.name, sourceInput.branch);
          }
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["deployments"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
      if (createdProject?.provider === "cloudflare-workers") {
        openProject({ kind: "worker", accountId: createdProject.accountId, name: createdProject.name });
      } else if (createdProject) {
        openProject({ kind: "project", provider: createdProject.provider, id: createdProject.id });
      }
      toast.success(`${title} complete`);
      close();
    } catch (error) {
      if (createdProject) {
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
        if (createdProject.provider === "cloudflare-workers") openProject({ kind: "worker", accountId: createdProject.accountId, name: createdProject.name });
        else openProject({ kind: "project", provider: createdProject.provider, id: createdProject.id });
        toast.error(`${createdProject.name} was created, but the remaining setup failed: ${errorMessage(error)}`);
        close();
      } else {
        toast.error(errorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  const applyEnvironmentVariables = async (project: UnifiedProject) => {
    for (const variable of environmentVariables) {
      if (project.provider === "vercel") {
        await window.deployDeck.vercel.createEnvVar(project.id, {
          key: variable.key,
          value: variable.value,
          type: variable.secret ? "sensitive" : "encrypted",
          targets: [variable.target],
          branch: variable.branch.trim() || undefined,
        });
      } else if (project.provider === "cloudflare-pages") {
        await window.deployDeck.cloudflare.upsertPagesEnv({
          accountId: project.accountId,
          projectName: project.name,
          environment: variable.target === "preview" ? "preview" : "production",
          name: variable.key,
          value: variable.value,
          secret: variable.secret,
        });
      } else if (variable.secret) {
        await window.deployDeck.cloudflare.putWorkerSecret(project.accountId, project.name, variable.key, variable.value);
      } else {
        await window.deployDeck.cloudflare.upsertWorkerVar(project.accountId, project.name, variable.key, variable.value);
      }
    }
  };

  const deployExisting = async (
    project: UnifiedProject,
    sourceInput: GitProjectSource | { kind: "local" | "direct"; sourceId: string },
  ) => {
    const target = prefs.data?.defaultDeploymentTarget ?? "preview";
    if (project.provider === "vercel") {
      await window.deployDeck.vercel.createDeployment({ projectId: project.id, source: sourceInput, target });
    } else if (project.provider === "cloudflare-pages") {
      await window.deployDeck.cloudflare.createPagesDeployment({
        projectId: project.id,
        projectName: project.name,
        accountId: project.accountId,
        source: sourceInput,
        target,
      });
    } else {
      if (sourceInput.kind === "git") {
        await window.deployDeck.cloudflare.triggerWorkerBuild(
          project.accountId,
          project.name,
          sourceInput.branch,
        );
        return;
      }
      await window.deployDeck.cloudflare.uploadWorker({
        accountId: project.accountId,
        scriptName: project.name,
        sourceId: sourceInput.sourceId,
        deploy: true,
      });
    }
  };

  return (
    <section className="absolute inset-0 z-[var(--z-panel-overlay)] flex flex-col bg-canvas" aria-label={title}>
      <header className="app-drag flex h-14 shrink-0 items-center border-b border-line bg-bg px-4">
        <Button variant="ghost" size="icon" className="app-no-drag" aria-label="Close creation flow" onClick={close}><X aria-hidden /></Button>
        <div className="ml-2 min-w-0">
          <h2 className="text-section font-semibold text-ink">{title}</h2>
          <p className="text-label text-muted">Provider-owned builds, credentials, and uploads stay in the main process.</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto w-full max-w-[760px]">
          <ol className="mb-6 flex items-center" aria-label="Creation progress">
            {STEP_LABELS.map((label, index) => (
              <li key={label} className={cn("flex items-center", index < STEP_LABELS.length - 1 && "flex-1")}>
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-label font-medium", index <= step ? "border-ember bg-ember text-ember-fg" : "border-line bg-panel text-muted")}>
                  {index < step ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span className={cn("ml-2 text-dense", index === step ? "font-medium text-ink" : "text-muted")}>{label}</span>
                {index < STEP_LABELS.length - 1 ? <span className="mx-3 h-px flex-1 bg-line" aria-hidden /> : null}
              </li>
            ))}
          </ol>

          <div className="rounded-panel border border-line bg-panel">
            <div className="border-b border-line bg-panel-header px-5 py-3">
              <h3 className="text-section font-semibold text-ink">{STEP_LABELS[step]}</h3>
              <p className="mt-0.5 text-dense text-muted">{stepDescription(step, provider)}</p>
            </div>
            <div className="p-5">
              {!providerWritable ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-control bg-warning-soft px-3 py-2 text-dense text-warning-ink">
                  <span>This provider is available read-only. Reconnect with the matching write permission to continue.</span>
                  <Button size="sm" variant="secondary" onClick={() => { close(); setScreen("settings"); }}>Reconnect</Button>
                </div>
              ) : null}
              {step === 0 ? (
                <ResourceStep
                  kind={kind}
                  provider={provider}
                  name={name}
                  accountId={accountId}
                  projectKey={projectKey}
                  accountOptions={accountOptions}
                  projectOptions={projectOptions}
                  onNameChange={setName}
                  onAccountChange={setAccountId}
                  onProjectChange={setProjectKey}
                />
              ) : step === 1 ? (
                <SourceStep
                  provider={provider}
                  sourceMode={sourceMode}
                  gitProvider={gitProvider}
                  repository={repository}
                  branch={branch}
                  source={source}
                  framework={framework}
                  rootDirectory={rootDirectory}
                  installCommand={installCommand}
                  buildCommand={buildCommand}
                  outputDirectory={outputDirectory}
                  workerLocalKind={workerLocalKind}
                  onSourceModeChange={setSourceMode}
                  onGitProviderChange={setGitProvider}
                  onRepositoryChange={setRepository}
                  onBranchChange={setBranch}
                  onChooseLocal={chooseLocal}
                  onFrameworkChange={setFramework}
                  onRootChange={setRootDirectory}
                  onInstallChange={setInstallCommand}
                  onBuildChange={setBuildCommand}
                  onOutputChange={setOutputDirectory}
                  onWorkerLocalKindChange={(next) => {
                    if (source) void window.deployDeck.files.releaseLocalSource(source.id);
                    setSource(null);
                    setWorkerLocalKind(next);
                  }}
                />
              ) : step === 2 ? (
                <EnvironmentStep
                  provider={provider}
                  variables={environmentVariables}
                  onChange={setEnvironmentVariables}
                />
              ) : (
                <ReviewStep
                  provider={provider}
                  name={kind === "deployment" ? selectedProject?.name ?? "—" : name}
                  sourceMode={sourceMode}
                  repository={repository}
                  branch={branch}
                  source={source}
                  framework={framework}
                  installCommand={installCommand}
                  buildCommand={buildCommand}
                  outputDirectory={outputDirectory}
                  environmentCount={environmentVariables.length}
                  progress={progress}
                />
              )}
            </div>
            <footer className="flex min-h-14 items-center justify-between border-t border-line bg-panel-header px-5 py-2.5">
              <Button variant="ghost" size="sm" disabled={saving || step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft aria-hidden /> Back</Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled={saving} onClick={close}>Cancel</Button>
                {step < STEP_LABELS.length - 1 ? <Button size="sm" disabled={!canAdvance} onClick={() => setStep((current) => current + 1)}>Continue</Button>
                  : <Button size="sm" loading={saving} disabled={!canAdvance} onClick={() => void submit()}>{saving ? "Working" : "Create and deploy"}</Button>}
              </div>
            </footer>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResourceStep({ kind, provider, name, accountId, projectKey, accountOptions, projectOptions, onNameChange, onAccountChange, onProjectChange }: {
  kind: CreateResourceKind;
  provider: Provider;
  name: string;
  accountId: string;
  projectKey: string;
  accountOptions: Array<{ value: string; label: string }>;
  projectOptions: Array<{ value: string; label: string }>;
  onNameChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onProjectChange: (value: string) => void;
}) {
  if (kind === "deployment") {
    return <Field label="Project"><SelectControl value={projectKey} onValueChange={onProjectChange} options={projectOptions} placeholder="Choose project or Worker" ariaLabel="Deployment project" className="w-full" /></Field>;
  }
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Provider"><Input value={providerLabel(provider)} disabled /></Field>
      {provider !== "vercel" ? <Field label="Cloudflare account"><SelectControl value={accountId} onValueChange={onAccountChange} options={accountOptions} placeholder="Choose account" ariaLabel="Cloudflare account" className="w-full" /></Field> : <Field label="Vercel scope"><Input value="Active team or personal account" disabled /></Field>}
      <Field label="Name" hint="Lowercase letters, numbers, hyphens, and underscores." className="col-span-2"><Input value={name} onChange={(event) => onNameChange(cleanName(event.target.value))} placeholder="my-project" autoFocus /></Field>
    </div>
  );
}

function SourceStep(props: {
  provider: Provider;
  sourceMode: SourceMode;
  gitProvider: GitProvider;
  repository: string;
  branch: string;
  source: LocalSourceHandle | null;
  framework: string;
  rootDirectory: string;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  workerLocalKind: WorkerLocalKind;
  onSourceModeChange: (value: SourceMode) => void;
  onGitProviderChange: (value: GitProvider) => void;
  onRepositoryChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onChooseLocal: () => Promise<void>;
  onFrameworkChange: (value: string) => void;
  onRootChange: (value: string) => void;
  onInstallChange: (value: string) => void;
  onBuildChange: (value: string) => void;
  onOutputChange: (value: string) => void;
  onWorkerLocalKindChange: (value: WorkerLocalKind) => void;
}) {
  return (
    <div className="space-y-5">
      <SegmentedControl value={props.sourceMode} onValueChange={props.onSourceModeChange} options={SOURCE_OPTIONS} ariaLabel="Deployment source" />
      {props.sourceMode === "git" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Git provider"><SelectControl value={props.gitProvider} onValueChange={(value) => props.onGitProviderChange(value as GitProvider)} options={GIT_PROVIDERS} ariaLabel="Git provider" className="w-full" /></Field>
          <Field label="Production branch"><Input value={props.branch} onChange={(event) => props.onBranchChange(event.target.value)} placeholder="main" /></Field>
          <Field label="Repository" hint="Use owner/repository or a full clone URL." className="col-span-2"><Input value={props.repository} onChange={(event) => props.onRepositoryChange(event.target.value)} placeholder="owner/repository" /></Field>
          {props.provider === "cloudflare-workers" ? <p className="col-span-2 rounded-control bg-warning-soft px-3 py-2 text-dense text-warning-ink">Workers Git builds require the Cloudflare Git App, a user-scoped Builds permission, a build token, and an existing trigger for this Worker. Reconnect Cloudflare after enabling those prerequisites.</p> : null}
        </div>
      ) : (
        <div className="space-y-3">
          {props.provider === "cloudflare-workers" ? (
            <SegmentedControl
              value={props.workerLocalKind}
              onValueChange={(value) => props.onWorkerLocalKindChange(value as WorkerLocalKind)}
              options={WORKER_LOCAL_OPTIONS}
              ariaLabel="Worker local source type"
            />
          ) : null}
          <button type="button" className="flex w-full items-center gap-3 rounded-control border border-dashed border-line-strong bg-surface px-4 py-4 text-left hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" onClick={() => void props.onChooseLocal()}>
            <span className="grid size-9 place-items-center rounded-control bg-panel text-ember-ink"><FolderOpen className="size-4" aria-hidden /></span>
            <span className="min-w-0"><span className="block text-body font-medium text-ink">{props.source ? props.source.name : localSourceLabel(props.provider)}</span><span className="block truncate text-dense text-muted">{props.source ? `${props.source.fileCount} files · ${formatBytes(props.source.totalBytes)} · expires ${new Date(props.source.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Choose a source without exposing file access to the renderer."}</span></span>
          </button>
          {props.source?.warnings.map((warning) => <p key={warning} className="mt-2 text-dense text-warning-ink">{warning}</p>)}
          {props.provider === "cloudflare-pages" ? <p className="rounded-control bg-warning-soft px-3 py-2 text-dense text-warning-ink">Direct Upload expects an already-built output folder and does not run local build commands. Cloudflare does not allow this project to switch to Git integration later.</p> : null}
        </div>
      )}
      {props.provider !== "cloudflare-workers" ? (
        <div className="grid grid-cols-2 gap-4 border-t border-line pt-5">
          <Field label="Framework"><Input value={props.framework} onChange={(event) => props.onFrameworkChange(event.target.value)} placeholder="Auto detect" /></Field>
          <Field label="Root directory"><Input value={props.rootDirectory} onChange={(event) => props.onRootChange(event.target.value)} placeholder="Project root" /></Field>
          <Field label="Install command"><Input value={props.installCommand} onChange={(event) => props.onInstallChange(event.target.value)} placeholder="Provider default" /></Field>
          <Field label="Build command"><Input value={props.buildCommand} onChange={(event) => props.onBuildChange(event.target.value)} placeholder="Auto detect" /></Field>
          <Field label="Output directory" className="col-span-2"><Input value={props.outputDirectory} onChange={(event) => props.onOutputChange(event.target.value)} placeholder={props.provider === "cloudflare-pages" ? "dist" : "Auto detect"} /></Field>
        </div>
      ) : null}
    </div>
  );
}

function EnvironmentStep({ provider, variables, onChange }: {
  provider: Provider;
  variables: DraftEnvironmentVariable[];
  onChange: (variables: DraftEnvironmentVariable[]) => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [secret, setSecret] = useState(false);
  const [target, setTarget] = useState<DraftEnvironmentVariable["target"]>("production");
  const [branch, setBranch] = useState("");
  const targetOptions = provider === "vercel"
    ? [
        { value: "production", label: "Production" },
        { value: "preview", label: "Preview" },
        { value: "development", label: "Development" },
      ]
    : provider === "cloudflare-pages"
      ? [{ value: "production", label: "Production" }, { value: "preview", label: "Preview" }]
      : [{ value: "production", label: "Worker binding" }];

  const add = () => {
    const normalizedKey = key.trim();
    if (!normalizedKey || !value) return;
    const next: DraftEnvironmentVariable = {
      id: `${normalizedKey}:${Date.now()}`,
      key: normalizedKey,
      value,
      secret,
      target,
      branch: provider === "vercel" ? branch.trim() : "",
    };
    onChange([...variables.filter((item) => !(item.key === next.key && item.target === next.target && item.branch === next.branch)), next]);
    setKey("");
    setValue("");
    setSecret(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-dense text-muted">Optional. Variables are written to the provider before the first deployment. Secret values remain in memory only for this flow.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input value={key} onChange={(event) => setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))} placeholder="VARIABLE_NAME" /></Field>
        <Field label="Value"><Input type={secret ? "password" : "text"} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Value" /></Field>
        <Field label="Target"><SelectControl value={target} onValueChange={(next) => setTarget(next as DraftEnvironmentVariable["target"])} options={targetOptions} ariaLabel="Environment target" className="w-full" /></Field>
        {provider === "vercel" ? <Field label="Git branch"><Input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="Optional" /></Field> : <div />}
        <label className="flex items-center gap-2 text-dense text-ink"><CheckboxControl checked={secret} onCheckedChange={setSecret} ariaLabel="Store as secret" /> Store as secret</label>
        <div className="flex justify-end"><Button size="sm" variant="secondary" disabled={!key.trim() || !value} onClick={add}><Plus aria-hidden /> Add variable</Button></div>
      </div>
      {variables.length ? (
        <div className="divide-y divide-line rounded-control border border-line bg-surface">
          {variables.map((variable) => (
            <div key={variable.id} className="flex min-h-11 items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-dense text-ink">{variable.key}</span>
              <span className="text-label text-muted">{variable.target}{variable.branch ? ` · ${variable.branch}` : ""}</span>
              <span className="font-mono text-label text-muted">{variable.secret ? "••••••" : variable.value}</span>
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${variable.key}`} onClick={() => onChange(variables.filter((item) => item.id !== variable.id))}><Trash2 aria-hidden /></Button>
            </div>
          ))}
        </div>
      ) : <div className="rounded-control border border-dashed border-line px-3 py-5 text-center text-dense text-muted">No variables added. Continue to use provider defaults.</div>}
    </div>
  );
}

function ReviewStep({ provider, name, sourceMode, repository, branch, source, framework, installCommand, buildCommand, outputDirectory, environmentCount, progress }: {
  provider: Provider;
  name: string;
  sourceMode: SourceMode;
  repository: string;
  branch: string;
  source: LocalSourceHandle | null;
  framework: string;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  environmentCount: number;
  progress?: OperationProgress;
}) {
  const rows = [
    ["Provider", providerLabel(provider)],
    ["Resource", name],
    ["Source", sourceMode === "git" ? `${repository} · ${branch}` : source ? `${source.name} · opaque handle` : "—"],
    ["Framework", framework || "Auto detect"],
    ["Install", installCommand || "Provider default"],
    ["Build", buildCommand || (provider === "cloudflare-pages" && sourceMode === "local" ? "Upload prebuilt output" : "Provider default")],
    ["Output", outputDirectory || "Provider default"],
    ["Environment", environmentCount ? `${environmentCount} variable${environmentCount === 1 ? "" : "s"}` : "No changes"],
  ];
  return (
    <div>
      <dl className="divide-y divide-line">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[140px_1fr] gap-4 py-2.5"><dt className="text-dense text-muted">{label}</dt><dd className="min-w-0 break-words text-dense text-ink">{value}</dd></div>)}</dl>
      {progress ? <div className="mt-4 rounded-control bg-surface px-3 py-3"><div className="flex items-center gap-2 text-dense text-ink">{!(["complete", "failed", "canceled"] as string[]).includes(progress.phase) ? <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}{progress.label}</div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-ember transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${Math.min(100, (progress.completed / Math.max(1, progress.total)) * 100)}%` }} /></div></div> : null}
    </div>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <div className={cn("space-y-1.5", className)}><Label className="text-ink">{label}</Label>{children}{hint ? <p className="text-label text-muted">{hint}</p> : null}</div>;
}

function providerForKind(kind: CreateResourceKind, project?: UnifiedProject): Provider {
  if (kind === "vercel-project") return "vercel";
  if (kind === "pages-project") return "cloudflare-pages";
  if (kind === "worker") return "cloudflare-workers";
  return project?.provider ?? "vercel";
}

function flowTitle(kind: CreateResourceKind): string {
  return {
    "vercel-project": "Create Vercel project",
    "pages-project": "Create Pages project",
    worker: "Create Worker",
    deployment: "Create deployment",
    domain: "Add domain",
    "dns-record": "Create DNS record",
    environment: "Add environment variables",
  }[kind];
}

function stepDescription(step: number, provider: Provider): string {
  if (step === 0) return "Choose the target account and identify the resource.";
  if (step === 1) return provider === "cloudflare-pages" ? "Git repositories build on Cloudflare; local uploads must already be built." : "Choose a Git reference or a local source owned by the main process.";
  return "Confirm provider, source, and build settings before creating anything.";
}

function sourceKind(provider: Provider, workerLocalKind: WorkerLocalKind): LocalSourceHandle["kind"] {
  if (provider === "cloudflare-pages") return "pages-output";
  if (provider === "cloudflare-workers") return workerLocalKind;
  return "source";
}

function localSourceLabel(provider: Provider): string {
  if (provider === "cloudflare-pages") return "Choose prebuilt output folder";
  if (provider === "cloudflare-workers") return "Choose Worker source";
  return "Choose source folder";
}

function providerLabel(provider: Provider): string {
  return provider === "vercel" ? "Vercel" : provider === "cloudflare-pages" ? "Cloudflare Pages" : "Cloudflare Workers";
}

function workerAsProject(worker: WorkerScript): UnifiedProject {
  return {
    id: worker.name,
    provider: "cloudflare-workers",
    accountId: worker.accountId,
    accountName: worker.accountName,
    name: worker.name,
    domains: worker.domains,
    updatedAt: worker.modifiedOn ?? new Date().toISOString(),
    dashboardUrl: worker.dashboardUrl,
  };
}

function cleanName(value: string): string {
  return value.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
