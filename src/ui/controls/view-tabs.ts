import { must } from '../../core/util.ts';
import { computed, type ReadonlySignal } from '../../store/signals.ts';
import { bind, type Scope } from '../dom.ts';
import { tabs } from './tabs.ts';

export interface ViewTabsOptions<T extends string> {
  label: string;
  names: Readonly<Record<T, string>>;
  /** Ansichten: je eine Liste von Seiten, die nebeneinander stehen */
  views: ReadonlySignal<readonly (readonly T[])[]>;
  /** die offene Ansicht, eine aus `views` */
  view: ReadonlySignal<readonly T[]>;
  /** gewählt wird die erste Seite der Ansicht */
  write(page: T): void;
}

/** Reiter über den Ansichten, benannt nach ihren Seiten; bei nur einer Ansicht ausgeblendet */
export function viewTabs<T extends string>(scope: Scope, o: ViewTabsOptions<T>): HTMLElement {
  const first = (v: readonly T[]): T => must(v[0], 'Seite');
  const list = tabs<T>(scope, {
    label: o.label,
    items: computed(() =>
      o.views.value.map((v) => ({ value: first(v), label: v.map((p) => o.names[p]).join(' · ') })),
    ),
    value: computed(() => first(o.view.value)),
    write: (p) => {
      o.write(p);
    },
  });
  bind(
    scope,
    () => o.views.value.length > 1,
    (many) => {
      list.hidden = !many;
    },
  );
  return list;
}
