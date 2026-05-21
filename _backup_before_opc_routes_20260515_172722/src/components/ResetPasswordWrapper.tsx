import { TranslationProvider } from '../lib/TranslationContext';
import MirakaResetPassword from './MirakaResetPassword';

export default function ResetPasswordWrapper() {
  return (
    <TranslationProvider>
      <MirakaResetPassword />
    </TranslationProvider>
  );
}
