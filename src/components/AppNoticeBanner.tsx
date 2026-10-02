export function AppNoticeBanner() {
  return (
    <div
      role="note"
      className="border-b border-border bg-warning-bg px-4 py-2 text-center text-xs font-medium text-warning sm:text-sm"
    >
      <span aria-hidden="true" className="mr-1">
        ⚠
      </span>
      Hackathon prototype — no real payments.
    </div>
  );
}
