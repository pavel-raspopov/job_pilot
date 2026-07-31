type Props = {
  percentage: number;
};

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CompletionIndicator({ percentage }: Props) {
  const offset = CIRCUMFERENCE * (1 - percentage / 100);

  return (
    <div
      className="relative h-16 w-16 shrink-0"
      role="img"
      aria-label={`Profile ${percentage}% complete`}
    >
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          strokeWidth="6"
          className="stroke-error/15"
        />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="stroke-error"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-semibold text-text-primary">
        {percentage}%
      </span>
    </div>
  );
}
