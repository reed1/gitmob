export function RestartingOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="text-foreground/70 text-lg">Restarting...</div>
    </div>
  );
}
