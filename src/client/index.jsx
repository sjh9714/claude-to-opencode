import { MoveInSettings } from './MoveInSettings.jsx';
import { STYLES } from './styles.js';
import { en, zh } from './locales.js';

const NS = 'dsh-movein';

export const inject = ['slots', 'locale'];

export function apply(ctx) {
  ctx.effect(() => {
    const tag = document.createElement('style');
    tag.setAttribute('data-plugin', 'dsh-movein');
    tag.textContent = STYLES;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, 'dsh-movein styles');

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-movein dictionaries');

  const mount = () => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-movein',
    order: 45,
    label: ctx.locale.bind(NS)('nav'),
    locale: NS,
  }, MoveInSettings));

  ctx.effect(() => {
    let dispose = mount();
    const off = ctx.on('locale/change', () => {
      dispose();
      dispose = mount();
    });
    return () => {
      off();
      dispose();
    };
  }, 'dsh-movein settings section');
}
