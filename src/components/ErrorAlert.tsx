type ErrorAlertProps = {
  title?: string;
  message: string;
  className?: string;
};

export function ErrorAlert({
  title = "Something went wrong",
  message,
  className = "",
}: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={`rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger ${className}`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-danger/90">{message}</p>
    </div>
  );
}
