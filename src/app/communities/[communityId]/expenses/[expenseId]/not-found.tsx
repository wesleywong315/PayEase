import { BackButton } from "@/components/BackButton";

export default function ExpenseNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <BackButton href="/communities" label="Go back" />
      <h1 className="type-h2">Expense not found</h1>
      <p className="text-sm text-muted">
        That expense does not exist in this community.
      </p>
    </div>
  );
}
