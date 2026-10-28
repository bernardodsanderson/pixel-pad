import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Download,
  Eraser,
  FilePlus,
  FolderOpen,
  Grid3x3,
  Minus,
  PaintBucket,
  Pencil,
  Plus,
  Redo2,
  Save,
  Share,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AuthSlot } from "@/components/auth-slot";
import { CloudLibrary } from "@/components/cloud-library";
import { PixelCanvas } from "@/components/pixel-canvas";
import { deleteDrawing, listDrawings, saveDrawing, type DrawingRecord } from "@/lib/drawings";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  GRID_SIZES,
  PALETTE,
  PALETTE_NAMES,
  DEFAULT_GRID_SIZE,
  type GridSize,
} from "@/lib/palette";
import { useEditor, type Tool } from "@/lib/editor-store";
import { createPixels, downloadPng, isCanvasEmpty } from "@/lib/pixel-utils";
import { usePwaInstall } from "@/lib/use-pwa";
import { cn } from "@/lib/utils";

const TOOLS: { id: Tool; label: string; shortcut: string; icon: typeof Pencil }[] = [
  { id: "pencil", label: "Pencil", shortcut: "1", icon: Pencil },
  { id: "eraser", label: "Eraser", shortcut: "2", icon: Eraser },
  { id: "fill", label: "Fill", shortcut: "3", icon: PaintBucket },
];

function stepGrid(size: GridSize, direction: -1 | 1): GridSize {
  const index = GRID_SIZES.indexOf(size);
  const next = GRID_SIZES[index + direction];
  return next ?? size;
}

function useCloudDrawings() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [drawings, setDrawings] = useState<DrawingRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedForUser = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const rows = await listDrawings();
    setDrawings(rows);
    return rows;
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      loadedForUser.current = null;
      setDrawings([]);
      setActiveId(null);
      setLibraryOpen(false);
      return;
    }
    if (loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await refresh();
        if (cancelled) return;
        const editor = useEditor.getState();
        const local = editor.pixels;
        // A reload restores the canvas from localStorage but not the cloud id.
        // If that canvas is exactly one of the saved sprites, re-attach it so
        // the next Save updates the sprite instead of creating a duplicate.
        const matching = rows.find(
          (row) =>
            row.gridSize === editor.gridSize &&
            row.pixels.length === local.length &&
            row.pixels.every((value, index) => value === local[index]),
        );
        if (matching) {
          setActiveId(matching.id);
          setTitle(matching.title);
        } else if (isCanvasEmpty(local) && rows[0]) {
          const latest = rows[0];
          editor.loadDrawing(latest.gridSize as GridSize, Int8Array.from(latest.pixels));
          setActiveId(latest.id);
          setTitle(latest.title);
        }
      } catch {
        if (!cancelled) setError("Could not load saved sprites.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isPending, refresh]);

  const goLogin = useCallback(() => {
    navigate({ to: "/login" });
  }, [navigate]);

  const save = useCallback(
    async (id = activeId) => {
      if (!user) {
        goLogin();
        return;
      }
      const editor = useEditor.getState();
      setSaving(true);
      setError(null);
      try {
        const saved = await saveDrawing({
          data: {
            id: id ?? undefined,
            title: title.trim() || "Untitled",
            gridSize: editor.gridSize,
            pixels: Array.from(editor.pixels),
          },
        });
        setActiveId(saved.id);
        setTitle(saved.title);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save";
        if (message === "Unauthorized") {
          goLogin();
          return;
        }
        setError(message);
        setLibraryOpen(true);
      } finally {
        setSaving(false);
      }
    },
    [activeId, goLogin, refresh, title, user],
  );

  useEffect(() => {
    if (!user || activeId == null) return;
    const unsub = useEditor.subscribe((state, prev) => {
      if (state.pixels === prev.pixels && state.gridSize === prev.gridSize) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void save(activeId);
      }, 1600);
    });
    return () => {
      unsub();
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [user, activeId, save]);

  const openLibrary = () => {
    if (!user) {
      goLogin();
      return;
    }
    setLibraryOpen(true);
    void refresh().catch(() => setError("Could not load saved sprites."));
  };

  const onNew = (size: GridSize = useEditor.getState().gridSize) => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    useEditor.getState().loadDrawing(size, createPixels(size));
    setActiveId(null);
    setTitle("Untitled");
    setError(null);
    setLibraryOpen(false);
  };

  const onOpen = (drawing: DrawingRecord) => {
    useEditor.getState().loadDrawing(drawing.gridSize as GridSize, Int8Array.from(drawing.pixels));
    setActiveId(drawing.id);
    setTitle(drawing.title);
    setLibraryOpen(false);
  };

  const onDelete = async (id: string) => {
    try {
      await deleteDrawing({ data: id });
      if (activeId === id) onNew();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete";
      setError(message);
    }
  };

  return {
    user,
    drawings,
    activeId,
    title,
    setTitle,
    libraryOpen,
    setLibraryOpen,
    saving,
    error,
    save,
    openLibrary,
    onNew,
    onOpen,
    onDelete,
  };
}

function ToolButton({
  pressed,
  label,
  shortcut,
  icon: Icon,
  onClick,
}: {
  pressed: boolean;
  label: string;
  shortcut: string;
  icon: typeof Pencil;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={pressed ? "default" : "ghost"}
          size="icon"
          aria-label={`${label} (${shortcut})`}
          aria-pressed={pressed}
          onClick={onClick}
          className="size-11 md:size-10"
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <span className="ml-1.5 text-muted-foreground">{shortcut}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function IconAction({
  label,
  shortcut,
  icon: Icon,
  onClick,
  disabled,
  pressed,
  className,
}: {
  label: string;
  shortcut?: string;
  icon: typeof Pencil;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={pressed ? "secondary" : "ghost"}
          size="icon"
          aria-label={shortcut ? `${label} (${shortcut})` : label}
          aria-pressed={pressed}
          onClick={onClick}
          disabled={disabled}
          className={cn("size-11 md:size-10", className)}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <span className="ml-1.5 text-muted-foreground">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function SizeStepper() {
  const gridSize = useEditor((s) => s.gridSize);
  const setGridSize = useEditor((s) => s.setGridSize);
  const atMin = gridSize === GRID_SIZES[0];
  const atMax = gridSize === GRID_SIZES[GRID_SIZES.length - 1];

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="iconSm"
        aria-label="Smaller grid"
        disabled={atMin}
        onClick={() => setGridSize(stepGrid(gridSize, -1))}
        className="size-9"
      >
        <Minus />
      </Button>
      <div className="min-w-16 px-1 text-center font-mono text-sm tabular-nums text-foreground">
        {gridSize}×{gridSize}
      </div>
      <Button
        variant="ghost"
        size="iconSm"
        aria-label="Larger grid"
        disabled={atMax}
        onClick={() => setGridSize(stepGrid(gridSize, 1))}
        className="size-9"
      >
        <Plus />
      </Button>
    </div>
  );
}

function PaletteGrid() {
  const colorIndex = useEditor((s) => s.colorIndex);
  const setColorIndex = useEditor((s) => s.setColorIndex);
  const setTool = useEditor((s) => s.setTool);
  const tool = useEditor((s) => s.tool);

  return (
    <div
      role="radiogroup"
      aria-label="Color palette"
      className="grid w-full grid-cols-8 gap-1 md:grid-cols-4 md:gap-1.5"
    >
      {PALETTE.map((hex, index) => {
        const selected = colorIndex === index;
        return (
          <Tooltip key={hex}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={PALETTE_NAMES[index]}
                onClick={() => {
                  setColorIndex(index);
                  if (tool === "eraser") setTool("pencil");
                }}
                className={cn(
                  "relative aspect-square w-full min-h-8 rounded-sm ring-offset-1 ring-offset-card transition-[box-shadow,transform] duration-150 ease-out",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  "active:enabled:scale-[0.96]",
                  selected
                    ? "ring-2 ring-primary"
                    : "ring-1 ring-foreground/15 hover:ring-foreground/30",
                )}
                style={{ backgroundColor: hex }}
              />
            </TooltipTrigger>
            <TooltipContent>{PALETTE_NAMES[index]}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function InstallButton() {
  const { standalone, canInstall, install } = usePwaInstall();
  const [helpOpen, setHelpOpen] = useState(false);

  if (standalone || !canInstall) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-11 shrink-0 px-3 sm:h-9"
            onClick={async () => {
              const result = await install();
              if (result === "manual") setHelpOpen(true);
            }}
            aria-label="Install Pixel Pad"
          >
            <Share />
            <span className="hidden md:inline">Install</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add to Home Screen</TooltipContent>
      </Tooltip>
      <AlertDialog open={helpOpen} onOpenChange={setHelpOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Install Pixel Pad</AlertDialogTitle>
            <AlertDialogDescription>
              Open your browser menu and choose Add to Home Screen. Pixel Pad will open full-screen
              like an app, with your drawings saved on this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Got it</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NewDrawingDialog({
  open,
  size,
  dirty,
  onSizeChange,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  size: GridSize;
  dirty: boolean;
  onSizeChange: (size: GridSize) => void;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>New drawing</AlertDialogTitle>
          <AlertDialogDescription>
            {dirty
              ? "Start a blank sprite. The current canvas stays in your library if it was saved."
              : "Pick a grid size and start a blank sprite."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div role="radiogroup" aria-label="Grid size" className="grid grid-cols-3 gap-2">
          {GRID_SIZES.map((value) => {
            const selected = size === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSizeChange(value)}
                className={cn(
                  "h-11 rounded-md font-mono text-sm transition-[color,background-color,transform] duration-150 ease-out",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  "active:enabled:scale-[0.96]",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                {value}×{value}
              </button>
            );
          })}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onCreate}>Start drawing</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StudioHeader({
  title,
  onSave,
  onOpenLibrary,
  onNew,
  saving,
}: {
  title: string;
  onSave: () => void;
  onOpenLibrary: () => void;
  onNew: () => void;
  saving: boolean;
}) {
  const pixels = useEditor((s) => s.pixels);
  const gridSize = useEditor((s) => s.gridSize);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);
  const empty = isCanvasEmpty(pixels);

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-2 sm:gap-2 sm:px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-5 shrink-0 grid-cols-2 gap-px" aria-hidden="true">
          <span className="bg-foreground" />
          <span className="bg-muted-foreground" />
          <span className="bg-muted-foreground" />
          <span className="bg-foreground" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-mono text-sm font-medium tracking-tight">{title}</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {saving ? "Saving…" : "Pixel Pad"}
          </p>
        </div>
      </div>

      <div className="ml-2 hidden md:block">
        <SizeStepper />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <IconAction
          label="Undo"
          shortcut="Ctrl+Z"
          icon={Undo2}
          onClick={undo}
          disabled={past.length === 0}
          className="hidden md:inline-flex"
        />
        <IconAction
          label="Redo"
          shortcut="Ctrl+Shift+Z"
          icon={Redo2}
          onClick={redo}
          disabled={future.length === 0}
          className="hidden md:inline-flex"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-11 px-3 sm:h-9"
          onClick={onNew}
          aria-label="New drawing"
        >
          <FilePlus />
          New
        </Button>
        <IconAction
          label="Library"
          icon={FolderOpen}
          onClick={onOpenLibrary}
          className="hidden md:inline-flex"
        />
        <IconAction label={saving ? "Saving" : "Save"} icon={Save} onClick={onSave} />
        <span className="hidden md:inline-flex">
          <InstallButton />
        </span>
        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
        <Button
          variant="default"
          size="sm"
          className="h-11 px-3 sm:h-9"
          onClick={() => downloadPng(pixels, gridSize)}
          disabled={empty}
          aria-label="Export PNG"
        >
          <Download />
          <span className="hidden sm:inline">Export PNG</span>
        </Button>
        <AuthSlot onOpenLibrary={onOpenLibrary} />
      </div>
    </header>
  );
}

function StudioDock() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const showGrid = useEditor((s) => s.showGrid);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const clear = useEditor((s) => s.clear);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);
  const colorIndex = useEditor((s) => s.colorIndex);
  const empty = isCanvasEmpty(useEditor((s) => s.pixels));

  return (
    <aside className="studio-dock order-2 flex shrink-0 flex-col gap-3 overflow-x-hidden border-t border-border bg-card p-3 md:order-1 md:w-56 md:border-t-0 md:border-r md:py-4">
      <div className="flex items-center justify-between gap-2 md:flex-col md:items-stretch">
        <div className="flex items-center gap-1 md:grid md:grid-cols-3">
          {TOOLS.map((item) => (
            <ToolButton
              key={item.id}
              pressed={tool === item.id}
              label={item.label}
              shortcut={item.shortcut}
              icon={item.icon}
              onClick={() => setTool(item.id)}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 md:mt-1 md:justify-between">
          <span className="inline-flex md:hidden">
            <IconAction
              label="Undo"
              shortcut="Ctrl+Z"
              icon={Undo2}
              onClick={undo}
              disabled={past.length === 0}
            />
          </span>
          <span className="inline-flex md:hidden">
            <IconAction
              label="Redo"
              shortcut="Ctrl+Shift+Z"
              icon={Redo2}
              onClick={redo}
              disabled={future.length === 0}
            />
          </span>
          <IconAction
            label={showGrid ? "Hide grid" : "Show grid"}
            shortcut="G"
            icon={Grid3x3}
            onClick={toggleGrid}
            pressed={showGrid}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear canvas"
                disabled={empty}
                className="size-11 md:size-10"
              >
                <Trash2 />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear the canvas?</AlertDialogTitle>
                <AlertDialogDescription>
                  All pixels will be erased. You can undo this after clearing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep drawing</AlertDialogCancel>
                <AlertDialogAction onClick={clear}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="flex justify-center md:hidden">
        <SizeStepper />
      </div>
      <Separator className="hidden md:block" />
      <div className="flex flex-col gap-2">
        <div className="hidden items-center justify-between md:flex">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            PICO-8
          </span>
          <span
            className="size-4 rounded-sm ring-1 ring-foreground/15"
            style={{ backgroundColor: PALETTE[colorIndex] }}
            aria-hidden="true"
          />
        </div>
        <PaletteGrid />
      </div>
    </aside>
  );
}

function useEditorHotkeys(onNew: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      const meta = event.metaKey || event.ctrlKey;
      const editor = useEditor.getState();

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        editor.redo();
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        downloadPng(editor.pixels, editor.gridSize);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "1" || event.key.toLowerCase() === "b") {
        editor.setTool("pencil");
      } else if (event.key === "2" || event.key.toLowerCase() === "e") {
        editor.setTool("eraser");
      } else if (event.key === "3" || event.key.toLowerCase() === "f") {
        editor.setTool("fill");
      } else if (event.key.toLowerCase() === "g") {
        editor.toggleGrid();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        onNew();
      } else if (event.key === "[") {
        editor.setGridSize(stepGrid(editor.gridSize, -1));
      } else if (event.key === "]") {
        editor.setGridSize(stepGrid(editor.gridSize, 1));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNew]);
}

export function PixelStudio() {
  const hydrate = useEditor((s) => s.hydrate);
  const pixels = useEditor((s) => s.pixels);
  const cloud = useCloudDrawings();
  const [newOpen, setNewOpen] = useState(false);
  const [newSize, setNewSize] = useState<GridSize>(DEFAULT_GRID_SIZE);

  const openNew = useCallback(() => {
    setNewSize(useEditor.getState().gridSize);
    setNewOpen(true);
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);
  useEditorHotkeys(openNew);

  return (
    <TooltipProvider>
      <div className="studio-shell flex h-dvh max-h-dvh flex-col overflow-x-hidden bg-background">
        <StudioHeader
          title={cloud.title}
          onSave={() => void cloud.save()}
          onOpenLibrary={cloud.openLibrary}
          onNew={openNew}
          saving={cloud.saving}
        />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <StudioDock />
          <main className="order-1 flex min-h-0 min-w-0 flex-1 bg-well md:order-2">
            <PixelCanvas />
          </main>
        </div>
        <CloudLibrary
          open={cloud.libraryOpen}
          drawings={cloud.drawings}
          activeId={cloud.activeId}
          title={cloud.title}
          saving={cloud.saving}
          error={cloud.error}
          onClose={() => cloud.setLibraryOpen(false)}
          onTitleChange={cloud.setTitle}
          onNew={openNew}
          onOpen={cloud.onOpen}
          onDelete={(id) => void cloud.onDelete(id)}
        />
        <NewDrawingDialog
          open={newOpen}
          size={newSize}
          dirty={!isCanvasEmpty(pixels)}
          onSizeChange={setNewSize}
          onOpenChange={setNewOpen}
          onCreate={() => cloud.onNew(newSize)}
        />
      </div>
    </TooltipProvider>
  );
}
