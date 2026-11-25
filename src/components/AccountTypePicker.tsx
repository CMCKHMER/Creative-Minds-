import { GraduationCap, ShieldCheck, UserRound } from 'lucide-react';
import { ACCOUNT_TYPE_OPTIONS, type AccountType } from '../lib/userProfile';

const ICONS: Record<AccountType, typeof GraduationCap> = {
  student: GraduationCap,
  teacher: ShieldCheck,
  user: UserRound,
};

const COPY: Record<AccountType, { title: string; hint: string }> = {
  student: {
    title: 'Student',
    hint: 'Take worksheets, play every game, and track your scores.',
  },
  teacher: {
    title: 'Teacher',
    hint: 'Everything students get, plus answer keys, Teacher Tools and downloads.',
  },
  user: {
    title: 'General user',
    hint: 'Same access as a student — games, worksheets and your score history.',
  },
};

interface AccountTypePickerProps {
  /** Current selection — null means nothing chosen yet (selection is required). */
  value: AccountType | null;
  onChange: (value: AccountType) => void;
  /** Legend shown above the three cards. */
  label?: string;
  /** Smaller variant for inline / follow-up prompts. */
  compact?: boolean;
  disabled?: boolean;
}

/**
 * Required Student / Teacher / General-user selector.
 *
 * The site owner needs to know who each account belongs to, so sign-up and
 * sign-in both ask. Students and general users get IDENTICAL privileges;
 * teachers only unlock teacher tools once verified (verified `.edu` email, or
 * an admin approval for e.g. Gmail teachers).
 */
export function AccountTypePicker({
  value,
  onChange,
  label = 'I am a…',
  compact = false,
  disabled = false,
}: AccountTypePickerProps) {
  return (
    <fieldset className={compact ? '' : 'space-y-2'} disabled={disabled}>
      <legend className="mb-1.5 block text-xs font-semibold text-slate-300">{label}</legend>
      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'sm:grid-cols-3'}`} role="radiogroup" aria-label={label}>
        {ACCOUNT_TYPE_OPTIONS.map((option) => {
          const id = option.id;
          const Icon = ICONS[id];
          const selected = value === id;
          return (
            <label
              key={id}
              className={`group flex cursor-pointer flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition ${
                selected
                  ? 'border-cyan-300/70 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(34,211,238,.35)]'
                  : 'border-slate-700 bg-slate-950 hover:border-slate-500'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="cmc-account-type"
                value={id}
                checked={selected}
                onChange={() => onChange(id)}
                className="sr-only"
              />
              <span className="flex items-center gap-1.5">
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-cyan-200' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span className={`text-xs font-bold ${selected ? 'text-white' : 'text-slate-200'}`}>
                  {COPY[id].title}
                </span>
              </span>
              {!compact && (
                <span className="text-[10px] leading-snug text-slate-400">{COPY[id].hint}</span>
              )}
            </label>
          );
        })}
      </div>
      {value === 'teacher' && (
        <p className="rounded-lg border border-amber-200/20 bg-amber-100/[0.05] px-3 py-2 text-[10.5px] leading-relaxed text-amber-100/90">
          Teacher tools unlock once your email is verified <strong>and</strong> it is your school
          address (e.g. <code className="rounded bg-white/10 px-1">name@aii.edu.kh</code>).
          Gmail teachers: an admin approves your account — everything works right away, and teacher
          tools unlock after approval.
        </p>
      )}
    </fieldset>
  );
}

export default AccountTypePicker;
