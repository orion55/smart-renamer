import cfonts from 'cfonts';
import pkg from '../../package.json';

export const printSmartRenamer = (): void => {
  cfonts.say('Renamer', {
    font: 'block',
    colors: ['green', 'gray'],
    background: 'transparent',
  });

  const now = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date());

  console.log(`  v${pkg.version}   ${now}\n`);
};
