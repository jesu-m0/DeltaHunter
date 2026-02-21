"use client";

interface Props {
  showUser: boolean;
  showRef: boolean;
  userLabel: string;
  refLabel: string;
  onToggleUser: () => void;
  onToggleRef: () => void;
}

export default function DriverToggle({
  showUser,
  showRef,
  userLabel,
  refLabel,
  onToggleUser,
  onToggleRef,
}: Props) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onToggleUser}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
          transition-all border
          ${
            showUser
              ? "bg-user/15 border-user/40 text-user"
              : "bg-surface2 border-border text-txt-dim"
          }
        `}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            showUser ? "bg-user" : "bg-txt-dim/30"
          }`}
        />
        {userLabel}
      </button>
      <button
        onClick={onToggleRef}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
          transition-all border
          ${
            showRef
              ? "bg-ref/15 border-ref/40 text-ref"
              : "bg-surface2 border-border text-txt-dim"
          }
        `}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            showRef ? "bg-ref" : "bg-txt-dim/30"
          }`}
        />
        {refLabel}
      </button>
    </div>
  );
}
