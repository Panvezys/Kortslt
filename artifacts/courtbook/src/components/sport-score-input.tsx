import { useEffect, useMemo, useState } from "react";
import {
  type SportConfig,
  type SportScore,
  type SetScore,
  getSportConfig,
  validateScore,
} from "@workspace/db/sports-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SportScoreInputProps {
  sport: string;
  /** Side A label (default "Žaidėjas A"). */
  labelA?: string;
  /** Side B label (default "Žaidėjas B"). */
  labelB?: string;
  /** Initial value (controlled or uncontrolled-with-initial). */
  value?: SportScore | null;
  /** Called whenever the score changes; second arg is true when validateScore returns []. */
  onChange: (score: SportScore, isValid: boolean) => void;
  /** Show a red error list under the inputs. */
  showErrors?: boolean;
  /** Disable inputs (e.g. while submitting). */
  disabled?: boolean;
}

function emptyScoreFor(cfg: SportConfig): SportScore {
  if (cfg.scoringType === "SET_BASED") {
    const sets: SetScore[] = Array.from({ length: cfg.setsPerMatch ?? 3 }, () => ({ a: 0, b: 0 }));
    return { type: "SET_BASED", sets };
  }
  return { type: "POINT_BASED", a: 0, b: 0 };
}

/**
 * Sport-aware score input.
 *  - SET_BASED sports (tennis/padel/squash/etc.): renders one row per set with two inputs.
 *  - POINT_BASED sports (basketball/football/etc.): renders two large total-score inputs.
 */
export function SportScoreInput({
  sport,
  labelA = "Žaidėjas A",
  labelB = "Žaidėjas B",
  value,
  onChange,
  showErrors,
  disabled,
}: SportScoreInputProps) {
  const cfg = useMemo(() => getSportConfig(sport), [sport]);
  const [score, setScore] = useState<SportScore>(() => value ?? emptyScoreFor(cfg));

  // Reset internal state when the sport changes (different shape).
  useEffect(() => {
    setScore((prev) => {
      if (prev.type === "SET_BASED" && cfg.scoringType === "SET_BASED") return prev;
      if (prev.type === "POINT_BASED" && cfg.scoringType === "POINT_BASED") return prev;
      return emptyScoreFor(cfg);
    });
  }, [cfg]);

  const errors = useMemo(() => validateScore(score, cfg), [score, cfg]);

  function update(next: SportScore) {
    setScore(next);
    const isValid = validateScore(next, cfg).length === 0;
    onChange(next, isValid);
  }

  if (cfg.scoringType === "SET_BASED" && score.type === "SET_BASED") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-xs text-muted-foreground">
          <div />
          <div className="text-center w-16">{labelA}</div>
          <div className="text-center w-16">{labelB}</div>
        </div>
        {score.sets.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
            <Label htmlFor={`set-${i}-a`} className="text-sm font-medium text-foreground">
              Setas {i + 1}
            </Label>
            <Input
              id={`set-${i}-a`}
              type="number"
              min={0}
              max={cfg.setMaxWithTiebreak ?? cfg.setTarget ?? 99}
              value={s.a}
              disabled={disabled}
              onChange={(e) => {
                const sets = [...score.sets];
                sets[i] = { ...sets[i], a: Math.max(0, Number(e.target.value) || 0) };
                update({ type: "SET_BASED", sets });
              }}
              className="w-16 text-center"
            />
            <Input
              id={`set-${i}-b`}
              type="number"
              min={0}
              max={cfg.setMaxWithTiebreak ?? cfg.setTarget ?? 99}
              value={s.b}
              disabled={disabled}
              onChange={(e) => {
                const sets = [...score.sets];
                sets[i] = { ...sets[i], b: Math.max(0, Number(e.target.value) || 0) };
                update({ type: "SET_BASED", sets });
              }}
              className="w-16 text-center"
            />
          </div>
        ))}
        {showErrors && errors.length > 0 && (
          <ul className="text-xs text-destructive space-y-0.5 pt-1">
            {errors.map((e, i) => (
              <li key={i}>• {e.message}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // POINT_BASED
  const pb = score.type === "POINT_BASED" ? score : { type: "POINT_BASED" as const, a: 0, b: 0 };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="pts-a" className="text-sm text-muted-foreground">{labelA}</Label>
          <Input
            id="pts-a"
            type="number"
            min={0}
            max={cfg.pointCap ?? 999}
            value={pb.a}
            disabled={disabled}
            onChange={(e) => update({ type: "POINT_BASED", a: Math.max(0, Number(e.target.value) || 0), b: pb.b })}
            className="text-3xl font-bold text-center h-16"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pts-b" className="text-sm text-muted-foreground">{labelB}</Label>
          <Input
            id="pts-b"
            type="number"
            min={0}
            max={cfg.pointCap ?? 999}
            value={pb.b}
            disabled={disabled}
            onChange={(e) => update({ type: "POINT_BASED", a: pb.a, b: Math.max(0, Number(e.target.value) || 0) })}
            className="text-3xl font-bold text-center h-16"
          />
        </div>
      </div>
      {showErrors && errors.length > 0 && (
        <ul className="text-xs text-destructive space-y-0.5 pt-1">
          {errors.map((e, i) => (
            <li key={i}>• {e.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
