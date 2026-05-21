import { TranslationProvider } from '../lib/TranslationContext';
import MirakaLogin from './Login';

export default function LoginWrapper() {
  return (
    <TranslationProvider>
      <MirakaLogin />
    </TranslationProvider>
  );
}
