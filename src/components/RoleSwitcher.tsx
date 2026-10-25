import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROLES, ROLE_PATH, useRole } from '../context/RoleContext';
import type { Role } from '../data/model';

/**
 * Demo-only role switcher (no sign-in yet). It moves to the matching role area
 * and remembers the choice. Real phone-OTP auth replaces it later.
 */
export function RoleSwitcher() {
  const { t } = useTranslation();
  const { role, setRole } = useRole();
  const navigate = useNavigate();

  const select = (next: Role) => {
    setRole(next);
    void navigate(ROLE_PATH[next]);
  };

  return (
    <div role="group" aria-label={t('roleSwitcher.label')} className="grid grid-cols-3 gap-2">
      {ROLES.map((item) => {
        const active = item === role;
        return (
          <button
            key={item}
            type="button"
            onClick={() => select(item)}
            aria-pressed={active}
            className={[
              'min-h-12 rounded-xl border-2 px-1 text-sm leading-tight font-semibold transition-colors',
              active
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-300 bg-white text-slate-800',
            ].join(' ')}
          >
            {t(`role.${item}`)}
          </button>
        );
      })}
    </div>
  );
}
