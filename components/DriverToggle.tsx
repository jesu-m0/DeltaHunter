"use client";

interface Props {
  showUser: boolean;
  showRef: boolean;
  userLabel: string;
  refLabel: string;
  onToggleUser: () => void;
  onToggleRef: () => void;
  /** Stretch both pills to fill the row — used by the mobile playback sheet. */
  fullWidth?: boolean;
}

export default function DriverToggle({
  showUser,
  showRef,
  userLabel,
  refLabel,
  onToggleUser,
  onToggleRef,
  fullWidth = false,
}: Props) {
  const btn = fullWidth
    ? "flex-1 min-w-0 justify-center py-2.5 text-sm"
    : "py-1.5 text-xs";

  return (
    <div className={`flex gap-2 ${fullWidth ? "w-full" : ""}`}>
      <button
        onClick={onToggleUser}
        className={`
          flex items-center gap-2 px-3 rounded-lg font-medium
          transition-all border ${btn}
          ${
            showUser
              ? "bg-user/15 border-user/40 text-user"
              : "bg-surface2 border-border text-txt-dim"
          }
        `}
      >
        <span
          className={`w-2 h-2 shrink-0 rounded-full ${
            showUser ? "bg-user" : "bg-txt-dim/30"
          }`}
        />
        <span className="truncate">{userLabel}</span>
      </button>
      <button
        onClick={onToggleRef}
        className={`
          flex items-center gap-2 px-3 rounded-lg font-medium
          transition-all border ${btn}
          ${
            showRef
              ? "bg-ref/15 border-ref/40 text-ref"
              : "bg-surface2 border-border text-txt-dim"
          }
        `}
      >
        <span
          className={`w-2 h-2 shrink-0 rounded-full ${
            showRef ? "bg-ref" : "bg-txt-dim/30"
          }`}
        />
        <span className="truncate">{refLabel}</span>
      </button>
    </div>
  );
}
