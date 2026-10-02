/* Shared choice controls of the bot / friend setup screens. */
import { choiceClass, SideDot, type SideKind } from '../components/ui';
import { useT } from '../i18n';

export const TIME_CONTROLS = ['3+2', '5+3', '10+5', '15+10', 'none'] as const;
export type TimeControl = (typeof TIME_CONTROLS)[number];
export const SIDES: readonly SideKind[] = ['white', 'black', 'random'];

export function SideSegmented({
  value,
  onChange,
}: {
  value: SideKind;
  onChange: (v: SideKind) => void;
}) {
  const t = useT();
  return (
    <div className="k-segmented" data-component="Segmented">
      {SIDES.map((s) => (
        <button
          key={s}
          className={choiceClass('k-segmented__option', value === s)}
          onClick={() => onChange(s)}
        >
          <SideDot side={s} />
          <span>{t(`common.${s}`)}</span>
        </button>
      ))}
    </div>
  );
}

export function TimeChips({
  value,
  onChange,
}: {
  value: TimeControl;
  onChange: (v: TimeControl) => void;
}) {
  const t = useT();
  return (
    <div className="k-chips" data-component="Chips">
      {TIME_CONTROLS.map((tc) => (
        <button
          key={tc}
          className={choiceClass('k-chip', value === tc)}
          onClick={() => onChange(tc)}
        >
          {tc === 'none' ? t('common.noClock') : tc}
        </button>
      ))}
    </div>
  );
}

export function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="k-field-group">
      <div className="k-field-group__label">{label}</div>
      {children}
    </div>
  );
}
