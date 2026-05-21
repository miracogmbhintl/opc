import { TranslationProvider } from '../lib/TranslationContext';
import MirakaLogin from './MirakaLogin';

export default function LoginWrapper() {
  return (
    <TranslationProvider>
      <MirakaLogin />
    </TranslationProvider>
  );
}
